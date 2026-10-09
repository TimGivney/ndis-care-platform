from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as OrmSession, joinedload

from ..auth import MANAGERS, audit, get_current_user, require_roles
from ..db import get_db
from ..models import (
    Participant, Qualification, User, Worker, WorkerAvailability,
)
from ..schemas import ParticipantIn, WorkerIn

router = APIRouter(prefix="/api", tags=["people"])


# ---------- serializers ----------

def participant_out(p: Participant, brief: bool = False) -> dict:
    d = {
        "id": p.id, "full_name": p.full_name, "preferred_name": p.preferred_name,
        "phone": p.phone, "is_active": p.is_active, "ndis_number": p.ndis_number,
        "plan_end": p.plan_end.isoformat() if p.plan_end else None,
    }
    if brief:
        return d
    d.update({
        "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
        "email": p.email, "address": p.address,
        "emergency_contact": p.emergency_contact, "guardian": p.guardian,
        "communication_prefs": p.communication_prefs,
        "plan_start": p.plan_start.isoformat() if p.plan_start else None,
        "support_coordinator": p.support_coordinator,
        "plan_manager": p.plan_manager, "support_needs": p.support_needs,
        "routines": p.routines, "mobility_info": p.mobility_info,
        "risks": p.risks, "allergies": p.allergies,
        "medical_info": p.medical_info, "medications": p.medications,
        "emergency_info": p.emergency_info,
    })
    return d


def worker_out(w: Worker, brief: bool = False) -> dict:
    d = {
        "id": w.id, "full_name": w.full_name, "preferred_name": w.preferred_name,
        "phone": w.phone, "position": w.position, "is_active": w.is_active,
    }
    if brief:
        return d
    d.update({
        "email": w.email, "address": w.address,
        "emergency_contact": w.emergency_contact,
        "employment_status": w.employment_status,
        "start_date": w.start_date.isoformat() if w.start_date else None,
        "skills": w.skills, "notes": w.notes,
        "availability": [
            {"id": a.id, "weekday": a.weekday, "start_time": a.start_time,
             "end_time": a.end_time, "kind": a.kind}
            for a in sorted(w.availability, key=lambda x: (x.weekday, x.start_time))
        ],
        "qualifications": [
            {"id": q.id, "name": q.name,
             "issued_on": q.issued_on.isoformat() if q.issued_on else None,
             "expires_on": q.expires_on.isoformat() if q.expires_on else None}
            for q in w.qualifications
        ],
    })
    return d


# ---------- participants ----------

@router.get("/participants")
def list_participants(user: User = Depends(get_current_user),
                      db: OrmSession = Depends(get_db)):
    q = db.query(Participant).filter(
        Participant.org_id == user.org_id, Participant.deleted == False)
    if user.role == "participant":
        q = q.filter(Participant.id == user.participant_id)
    return {"participants": [participant_out(p, brief=True) for p in q.all()]}


@router.get("/participants/{pid}")
def get_participant(pid: int, user: User = Depends(get_current_user),
                    db: OrmSession = Depends(get_db)):
    p = db.get(Participant, pid)
    if not p or p.org_id != user.org_id or p.deleted:
        raise HTTPException(404, "Not found")
    if user.role == "participant" and user.participant_id != pid:
        raise HTTPException(403, "Not your record")
    audit(db, user, "view", "participant", pid)
    db.commit()
    return {"participant": participant_out(p)}


@router.post("/participants")
def create_participant(body: ParticipantIn,
                       user: User = Depends(require_roles(*MANAGERS)),
                       db: OrmSession = Depends(get_db)):
    p = Participant(org_id=user.org_id, **body.model_dump())
    db.add(p)
    db.flush()
    audit(db, user, "create", "participant", p.id, p.full_name)
    db.commit()
    return {"participant": participant_out(p)}


@router.put("/participants/{pid}")
def update_participant(pid: int, body: ParticipantIn,
                       user: User = Depends(require_roles(*MANAGERS)),
                       db: OrmSession = Depends(get_db)):
    p = db.get(Participant, pid)
    if not p or p.org_id != user.org_id or p.deleted:
        raise HTTPException(404, "Not found")
    for k, v in body.model_dump().items():
        setattr(p, k, v)
    audit(db, user, "update", "participant", pid)
    db.commit()
    return {"participant": participant_out(p)}


@router.delete("/participants/{pid}")
def delete_participant(pid: int, user: User = Depends(require_roles(*MANAGERS)),
                       db: OrmSession = Depends(get_db)):
    p = db.get(Participant, pid)
    if not p or p.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    p.deleted = True
    audit(db, user, "delete", "participant", pid, p.full_name)
    db.commit()
    return {"ok": True}


# ---------- workers ----------

def _apply_worker(w: Worker, body: WorkerIn):
    data = body.model_dump(exclude={"availability", "qualifications"})
    for k, v in data.items():
        setattr(w, k, v)
    w.availability.clear()
    for a in body.availability:
        w.availability.append(WorkerAvailability(**a.model_dump()))
    w.qualifications.clear()
    for q in body.qualifications:
        w.qualifications.append(Qualification(**q.model_dump()))


@router.get("/workers")
def list_workers(user: User = Depends(get_current_user),
                 db: OrmSession = Depends(get_db)):
    q = db.query(Worker).filter(
        Worker.org_id == user.org_id, Worker.deleted == False)
    if user.role == "worker":
        q = q.filter(Worker.id == user.worker_id)
    return {"workers": [worker_out(w, brief=True) for w in q.all()]}


@router.get("/workers/{wid}")
def get_worker(wid: int, user: User = Depends(get_current_user),
               db: OrmSession = Depends(get_db)):
    w = db.query(Worker).options(
        joinedload(Worker.availability), joinedload(Worker.qualifications)
    ).get(wid)
    if not w or w.org_id != user.org_id or w.deleted:
        raise HTTPException(404, "Not found")
    if user.role == "worker" and user.worker_id != wid:
        raise HTTPException(403, "Not your record")
    return {"worker": worker_out(w)}


@router.post("/workers")
def create_worker(body: WorkerIn,
                  user: User = Depends(require_roles(*MANAGERS)),
                  db: OrmSession = Depends(get_db)):
    w = Worker(org_id=user.org_id)
    _apply_worker(w, body)
    db.add(w)
    db.flush()
    audit(db, user, "create", "worker", w.id, w.full_name)
    db.commit()
    return {"worker": worker_out(w)}


@router.put("/workers/{wid}")
def update_worker(wid: int, body: WorkerIn,
                  user: User = Depends(require_roles(*MANAGERS)),
                  db: OrmSession = Depends(get_db)):
    w = db.query(Worker).options(
        joinedload(Worker.availability), joinedload(Worker.qualifications)
    ).get(wid)
    if not w or w.org_id != user.org_id or w.deleted:
        raise HTTPException(404, "Not found")
    _apply_worker(w, body)
    audit(db, user, "update", "worker", wid)
    db.commit()
    return {"worker": worker_out(w)}


@router.delete("/workers/{wid}")
def delete_worker(wid: int, user: User = Depends(require_roles(*MANAGERS)),
                  db: OrmSession = Depends(get_db)):
    w = db.get(Worker, wid)
    if not w or w.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    w.deleted = True
    audit(db, user, "delete", "worker", wid, w.full_name)
    db.commit()
    return {"ok": True}
