from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession, joinedload

from ..auth import MANAGERS, audit, get_current_user, require_roles
from ..db import get_db
from ..models import (
    AuditLog, ClientRequest, Incident, Participant, Qualification, Shift,
    ShiftNote, Timesheet, User, Worker,
)
from ..schemas import IncidentIn, IncidentUpdate, RequestIn, RequestUpdate

router = APIRouter(prefix="/api", tags=["ops"])


# ---------- dashboard ----------

@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user),
              db: OrmSession = Depends(get_db)):
    today = date.today()
    org = user.org_id

    todays = db.query(Shift).options(
        joinedload(Shift.worker), joinedload(Shift.participant)
    ).filter(Shift.org_id == org, Shift.date == today).all()

    checked_in_ids = set(
        r[0] for r in db.query(Timesheet.shift_id)
        .join(Shift, Timesheet.shift_id == Shift.id)
        .filter(Shift.org_id == org, Timesheet.check_in_at != None).all())

    unfilled = [s for s in todays if s.status == "unfilled"]
    missed = [s for s in todays
              if s.worker_id and s.status in ("scheduled", "confirmed")
              and s.id not in checked_in_ids
              and s.start_time < datetime.now().strftime("%H:%M")]

    base = {
        "todays_shifts": len(todays),
        "unfilled": [{"id": s.id, "participant_name": s.participant.full_name,
                      "start_time": s.start_time} for s in unfilled],
        "missed_checkins": [{
            "id": s.id, "worker_name": s.worker.full_name if s.worker else None,
            "participant_name": s.participant.full_name,
            "start_time": s.start_time} for s in missed],
    }

    if user.role in MANAGERS:
        notes_pending = db.query(ShiftNote).join(Shift).filter(
            Shift.org_id == org, ShiftNote.status == "submitted").count()
        open_incidents = db.query(Incident).filter(
            Incident.org_id == org, Incident.status != "closed").count()
        open_requests = db.query(ClientRequest).filter(
            ClientRequest.org_id == org,
            ClientRequest.status.in_(["submitted", "assigned", "in_progress"])
        ).count()
        soon = today + timedelta(days=30)
        expiring = db.query(Qualification).join(Worker).filter(
            Worker.org_id == org, Qualification.expires_on != None,
            Qualification.expires_on <= soon).all()
        base.update({
            "notes_pending_review": notes_pending,
            "open_incidents": open_incidents,
            "open_requests": open_requests,
            "expiring_certs": [{
                "id": q.id, "name": q.name, "worker_name": q.worker.full_name,
                "expires_on": q.expires_on.isoformat()} for q in expiring],
        })
    return base


# ---------- incidents ----------

def incident_out(i: Incident) -> dict:
    return {
        "id": i.id, "participant_id": i.participant_id,
        "participant_name": i.participant.full_name if i.participant else None,
        "occurred_at": i.occurred_at.isoformat(),
        "location": i.location, "people_involved": i.people_involved,
        "category": i.category, "severity": i.severity,
        "description": i.description, "actions_taken": i.actions_taken,
        "follow_up": i.follow_up, "status": i.status,
        "reported_by": i.reported_by,
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }


@router.get("/incidents")
def list_incidents(status: str | None = None,
                   user: User = Depends(get_current_user),
                   db: OrmSession = Depends(get_db)):
    q = db.query(Incident).options(joinedload(Incident.participant)).filter(
        Incident.org_id == user.org_id)
    if user.role == "worker":
        q = q.filter(Incident.reported_by == user.id)
    elif user.role == "participant":
        q = q.filter(Incident.participant_id == user.participant_id)
    if status:
        q = q.filter(Incident.status == status)
    return {"incidents": [incident_out(i) for i in
                          q.order_by(Incident.id.desc()).limit(200).all()]}


@router.post("/incidents")
def create_incident(body: IncidentIn,
                    user: User = Depends(get_current_user),
                    db: OrmSession = Depends(get_db)):
    p = db.get(Participant, body.participant_id)
    if not p or p.org_id != user.org_id:
        raise HTTPException(400, "Unknown participant")
    i = Incident(org_id=user.org_id, reported_by=user.id, **body.model_dump())
    db.add(i)
    db.flush()
    audit(db, user, "create", "incident", i.id, i.severity)
    db.commit()
    return {"incident": incident_out(i)}


@router.put("/incidents/{iid}")
def update_incident(iid: int, body: IncidentUpdate,
                    user: User = Depends(require_roles(*MANAGERS)),
                    db: OrmSession = Depends(get_db)):
    i = db.get(Incident, iid)
    if not i or i.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(i, k, v)
    audit(db, user, "update", "incident", iid, body.status)
    db.commit()
    return {"incident": incident_out(i)}


# ---------- client requests ----------

def request_out(r: ClientRequest) -> dict:
    return {
        "id": r.id, "participant_id": r.participant_id,
        "participant_name": r.participant.full_name if r.participant else None,
        "kind": r.kind, "body": r.body, "status": r.status,
        "assigned_to": r.assigned_to, "response": r.response,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


@router.get("/requests")
def list_requests(status: str | None = None,
                  user: User = Depends(get_current_user),
                  db: OrmSession = Depends(get_db)):
    q = db.query(ClientRequest).options(
        joinedload(ClientRequest.participant)
    ).filter(ClientRequest.org_id == user.org_id)
    if user.role == "participant":
        q = q.filter(ClientRequest.participant_id == user.participant_id)
    if status:
        q = q.filter(ClientRequest.status == status)
    return {"requests": [request_out(r) for r in
                         q.order_by(ClientRequest.id.desc()).limit(200).all()]}


@router.post("/requests")
def create_request(body: RequestIn,
                   user: User = Depends(get_current_user),
                   db: OrmSession = Depends(get_db)):
    if user.role == "participant":
        if not user.participant_id:
            raise HTTPException(400, "Account not linked to a participant")
        pid = user.participant_id
    elif body.participant_id:
        p = db.get(Participant, body.participant_id)
        if not p or p.org_id != user.org_id:
            raise HTTPException(400, "Unknown participant")
        pid = p.id
    else:
        raise HTTPException(400, "participant_id required")
    r = ClientRequest(org_id=user.org_id, participant_id=pid,
                      kind=body.kind, body=body.body)
    db.add(r)
    db.flush()
    audit(db, user, "create", "client_request", r.id)
    db.commit()
    return {"request": request_out(r)}


@router.put("/requests/{rid}")
def update_request(rid: int, body: RequestUpdate,
                   user: User = Depends(require_roles(*MANAGERS)),
                   db: OrmSession = Depends(get_db)):
    r = db.get(ClientRequest, rid)
    if not r or r.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    audit(db, user, "update", "client_request", rid, body.status)
    db.commit()
    return {"request": request_out(r)}


# ---------- audit ----------

@router.get("/audit")
def list_audit(limit: int = Query(100, le=500),
               entity: str | None = None,
               user: User = Depends(require_roles(*MANAGERS)),
               db: OrmSession = Depends(get_db)):
    q = db.query(AuditLog).filter(AuditLog.org_id == user.org_id)
    if entity:
        q = q.filter(AuditLog.entity == entity)
    rows = q.order_by(AuditLog.id.desc()).limit(limit).all()
    return {"audit": [{
        "id": a.id, "user_name": a.user_name, "action": a.action,
        "entity": a.entity, "entity_id": a.entity_id, "detail": a.detail,
        "at": a.at.isoformat() if a.at else None,
    } for a in rows]}
