from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session as OrmSession, joinedload

from ..auth import (
    MANAGERS, audit, get_current_user, notify, notify_managers,
    require_roles, worker_user,
)
from ..db import get_db
from ..models import (
    LocationCheck, Participant, Shift, ShiftNote, ShiftOffer, Timesheet, User,
    Worker, WorkerAvailability,
)
from ..schemas import (
    CancelIn, CheckInOutIn, NoteIn, OfferIn, ShiftIn, ShiftUpdate,
)

router = APIRouter(prefix="/api", tags=["roster"])


def shift_out(s: Shift) -> dict:
    return {
        "id": s.id, "date": s.date.isoformat(),
        "start_time": s.start_time, "end_time": s.end_time,
        "location": s.location, "service_type": s.service_type,
        "instructions": s.instructions, "required_skills": s.required_skills,
        "status": s.status,
        "worker_id": s.worker_id,
        "worker_name": s.worker.full_name if s.worker else None,
        "participant_id": s.participant_id,
        "participant_name": s.participant.full_name if s.participant else None,
        "cancel_reason": s.cancel_reason,
    }


def note_out(n: ShiftNote) -> dict:
    return {
        "id": n.id, "shift_id": n.shift_id, "worker_id": n.worker_id,
        "participant_id": n.participant_id, "body": n.body,
        "status": n.status, "version": n.version, "restricted": n.restricted,
        "submitted_at": n.submitted_at.isoformat() if n.submitted_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "participant_name": n.shift.participant.full_name if n.shift else None,
        "worker_name": n.shift.worker.full_name if n.shift and n.shift.worker else None,
    }


def _get_shift(db: OrmSession, sid: int, org_id: int) -> Shift:
    s = db.query(Shift).options(
        joinedload(Shift.worker), joinedload(Shift.participant)
    ).get(sid)
    if not s or s.org_id != org_id:
        raise HTTPException(404, "Shift not found")
    return s


def _availability_warning(db: OrmSession, s: Shift) -> str | None:
    """Warn (don't block) when assigning outside stated availability."""
    if not s.worker_id:
        return None
    weekday = s.date.weekday()
    rows = db.query(WorkerAvailability).filter(
        WorkerAvailability.worker_id == s.worker_id,
        WorkerAvailability.weekday == weekday,
    ).all()
    if not rows:
        return None
    unavailable = [a for a in rows if a.kind in ("unavailable", "leave")]
    if any(a.start_time <= s.end_time and a.end_time >= s.start_time for a in unavailable):
        return "Worker marked unavailable/leave in this window"
    avail = [a for a in rows if a.kind in ("available", "preferred")]
    if avail and not any(a.start_time <= s.start_time and a.end_time >= s.end_time
                         for a in avail):
        return "Outside worker's stated availability"
    return None


@router.get("/shifts")
def list_shifts(
    start: date = Query(...), end: date = Query(...),
    worker_id: int | None = None, participant_id: int | None = None,
    status: str | None = None,
    user: User = Depends(get_current_user), db: OrmSession = Depends(get_db),
):
    q = db.query(Shift).options(
        joinedload(Shift.worker), joinedload(Shift.participant)
    ).filter(Shift.org_id == user.org_id, Shift.date >= start, Shift.date <= end)
    if user.role == "worker":
        q = q.filter(Shift.worker_id == user.worker_id)
    elif user.role == "participant":
        q = q.filter(Shift.participant_id == user.participant_id)
    else:
        if worker_id:
            q = q.filter(Shift.worker_id == worker_id)
        if participant_id:
            q = q.filter(Shift.participant_id == participant_id)
    if status:
        q = q.filter(Shift.status == status)
    shifts = q.order_by(Shift.date, Shift.start_time).all()
    return {"shifts": [shift_out(s) for s in shifts]}


@router.post("/shifts")
def create_shift(body: ShiftIn, user: User = Depends(require_roles(*MANAGERS)),
                 db: OrmSession = Depends(get_db)):
    p = db.get(Participant, body.participant_id)
    if not p or p.org_id != user.org_id:
        raise HTTPException(400, "Unknown participant")
    if body.worker_id:
        w = db.get(Worker, body.worker_id)
        if not w or w.org_id != user.org_id:
            raise HTTPException(400, "Unknown worker")
    s = Shift(org_id=user.org_id, status="scheduled" if body.worker_id else "unfilled",
              **body.model_dump())
    warning = _availability_warning(db, s)
    db.add(s)
    db.flush()
    if s.worker_id:
        wu = worker_user(db, s.worker_id)
        if wu:
            notify(db, s.org_id, wu.id, "shift_assigned",
                   f"New shift on {s.date} {s.start_time}-{s.end_time}",
                   f"{p.full_name} · {s.location or 'see shift details'}",
                   "/today")
    audit(db, user, "create", "shift", s.id,
          f"{s.date} {s.start_time}-{s.end_time} participant {s.participant_id}")
    db.commit()
    return {"shift": shift_out(s), "warning": warning}


@router.put("/shifts/{sid}")
def update_shift(sid: int, body: ShiftUpdate,
                 user: User = Depends(require_roles(*MANAGERS)),
                 db: OrmSession = Depends(get_db)):
    s = _get_shift(db, sid, user.org_id)
    old_worker_id = s.worker_id
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in (
            "scheduled", "confirmed", "unfilled", "no_show"):
        raise HTTPException(400, "Invalid status change")
    for k, v in data.items():
        setattr(s, k, v)
    if s.worker_id and s.status == "unfilled":
        s.status = "scheduled"
    warning = _availability_warning(db, s)
    if s.worker_id and s.worker_id != old_worker_id:
        wu = worker_user(db, s.worker_id)
        if wu:
            notify(db, s.org_id, wu.id, "shift_assigned",
                   f"You were assigned a shift on {s.date} "
                   f"{s.start_time}-{s.end_time}",
                   f"{s.participant.full_name if s.participant else ''} · "
                   f"{s.location or 'see shift details'}", "/today")
    audit(db, user, "update", "shift", sid)
    db.commit()
    return {"shift": shift_out(s), "warning": warning}


@router.post("/shifts/{sid}/cancel")
def cancel_shift(sid: int, body: CancelIn,
                 user: User = Depends(require_roles(*MANAGERS)),
                 db: OrmSession = Depends(get_db)):
    s = _get_shift(db, sid, user.org_id)
    s.status = "cancelled"
    s.cancelled_at = datetime.utcnow()
    s.cancelled_by = user.id
    s.cancel_reason = body.reason
    wu = worker_user(db, s.worker_id)
    if wu and wu.id != user.id:
        notify(db, s.org_id, wu.id, "shift_cancelled",
               f"Shift on {s.date} {s.start_time} was cancelled",
               body.reason, "/today")
    audit(db, user, "cancel", "shift", sid, body.reason)
    db.commit()
    return {"shift": shift_out(s)}


# ---------- check in / out ----------

def _worker_for_user(user: User) -> int:
    if not user.worker_id:
        raise HTTPException(400, "Account is not linked to a worker record")
    return user.worker_id


@router.post("/shifts/{sid}/check-in")
def check_in(sid: int, body: CheckInOutIn,
             user: User = Depends(get_current_user),
             db: OrmSession = Depends(get_db)):
    s = _get_shift(db, sid, user.org_id)
    wid = _worker_for_user(user)
    if s.worker_id != wid:
        raise HTTPException(403, "Not your shift")
    if s.status in ("cancelled", "completed"):
        raise HTTPException(400, f"Shift is {s.status}")
    if s.status not in ("checked_in", "in_progress"):
        s.status = "checked_in"
    db.add(LocationCheck(shift_id=s.id, worker_id=wid, kind="check_in",
                         lat=body.lat, lng=body.lng, accuracy_m=body.accuracy_m))
    ts = db.query(Timesheet).filter(Timesheet.shift_id == s.id).first()
    if not ts:
        ts = Timesheet(shift_id=s.id, worker_id=wid, participant_id=s.participant_id,
                       date=s.date, scheduled_start=s.start_time,
                       scheduled_end=s.end_time)
        db.add(ts)
    ts.check_in_at = datetime.utcnow()
    audit(db, user, "check_in", "shift", sid,
          f"lat={body.lat} lng={body.lng}" if body.lat else "no location")
    db.commit()
    return {"shift": shift_out(s)}


@router.post("/shifts/{sid}/check-out")
def check_out(sid: int, body: CheckInOutIn,
              user: User = Depends(get_current_user),
              db: OrmSession = Depends(get_db)):
    s = _get_shift(db, sid, user.org_id)
    wid = _worker_for_user(user)
    if s.worker_id != wid:
        raise HTTPException(403, "Not your shift")
    if s.status != "checked_in" and s.status != "in_progress":
        raise HTTPException(400, "Not checked in")
    s.status = "completed"
    now = datetime.utcnow()
    db.add(LocationCheck(shift_id=s.id, worker_id=wid, kind="check_out",
                         lat=body.lat, lng=body.lng, accuracy_m=body.accuracy_m))
    ts = db.query(Timesheet).filter(Timesheet.shift_id == s.id).first()
    if ts:
        ts.check_out_at = now
        if ts.check_in_at:
            ts.hours = round((now - ts.check_in_at).total_seconds() / 3600, 2)
    audit(db, user, "check_out", "shift", sid)
    db.commit()
    return {"shift": shift_out(s)}


# ---------- notes ----------

@router.get("/shifts/{sid}/notes")
def list_shift_notes(sid: int, user: User = Depends(get_current_user),
                     db: OrmSession = Depends(get_db)):
    s = _get_shift(db, sid, user.org_id)
    if user.role == "worker" and s.worker_id != user.worker_id:
        raise HTTPException(403, "Not your shift")
    q = db.query(ShiftNote).options(joinedload(ShiftNote.shift)).filter(
        ShiftNote.shift_id == sid)
    if user.role in ("worker", "participant"):
        q = q.filter(ShiftNote.restricted == False)
    if user.role == "participant":
        q = q.filter(ShiftNote.status != "draft")
    return {"notes": [note_out(n) for n in q.all()]}


@router.post("/shifts/{sid}/notes")
def create_note(sid: int, body: NoteIn,
                user: User = Depends(get_current_user),
                db: OrmSession = Depends(get_db)):
    s = _get_shift(db, sid, user.org_id)
    wid = _worker_for_user(user)
    if s.worker_id != wid:
        raise HTTPException(403, "Not your shift")
    n = ShiftNote(shift_id=s.id, worker_id=wid, participant_id=s.participant_id,
                  body=body.body, restricted=body.restricted)
    if body.submit:
        n.status = "submitted"
        n.submitted_at = datetime.utcnow()
    db.add(n)
    db.flush()
    if n.status == "submitted":
        notify_managers(db, s.org_id, "note_submitted",
                        f"Note from {user.name} for "
                        f"{s.participant.full_name if s.participant else 'a client'}",
                        n.body[:200], "/notes", exclude_user_id=user.id)
    audit(db, user, "create", "shift_note", n.id,
          "submitted" if body.submit else "draft")
    db.commit()
    return {"note": note_out(n)}


@router.put("/notes/{nid}")
def update_note(nid: int, body: NoteIn,
                user: User = Depends(get_current_user),
                db: OrmSession = Depends(get_db)):
    n = db.query(ShiftNote).options(joinedload(ShiftNote.shift)).get(nid)
    if not n or n.shift.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    is_manager = user.role in MANAGERS
    if not is_manager and n.worker_id != user.worker_id:
        raise HTTPException(403, "Not your note")
    if not is_manager and n.status == "reviewed":
        raise HTTPException(400, "Note already reviewed; editing locked")
    n.body = body.body
    n.restricted = body.restricted
    n.version += 1
    if body.submit and n.status == "draft":
        n.status = "submitted"
        n.submitted_at = datetime.utcnow()
        notify_managers(db, n.shift.org_id, "note_submitted",
                        f"Note from {user.name}", n.body[:200], "/notes",
                        exclude_user_id=user.id)
    audit(db, user, "update", "shift_note", nid, f"v{n.version}")
    db.commit()
    return {"note": note_out(n)}


@router.post("/notes/{nid}/review")
def review_note(nid: int, user: User = Depends(require_roles(*MANAGERS)),
                db: OrmSession = Depends(get_db)):
    n = db.query(ShiftNote).options(joinedload(ShiftNote.shift)).get(nid)
    if not n or n.shift.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    n.status = "reviewed"
    n.reviewed_by = user.id
    n.reviewed_at = datetime.utcnow()
    audit(db, user, "review", "shift_note", nid)
    db.commit()
    return {"note": note_out(n)}


@router.get("/notes")
def list_notes(status: str | None = None,
               user: User = Depends(get_current_user),
               db: OrmSession = Depends(get_db)):
    q = db.query(ShiftNote).join(Shift).filter(Shift.org_id == user.org_id)
    if user.role == "worker":
        q = q.filter(ShiftNote.worker_id == user.worker_id,
                     ShiftNote.restricted == False)
    elif user.role == "participant":
        q = q.filter(ShiftNote.participant_id == user.participant_id,
                     ShiftNote.restricted == False, ShiftNote.status != "draft")
    if status:
        q = q.filter(ShiftNote.status == status)
    notes = q.order_by(ShiftNote.id.desc()).limit(200).all()
    return {"notes": [note_out(n) for n in notes]}


# ---------- shift offers / swaps ----------

def offer_out(o: ShiftOffer) -> dict:
    s = o.shift
    return {
        "id": o.id, "shift_id": o.shift_id, "kind": o.kind,
        "status": o.status,
        "created_by": o.created_by,
        "creator_name": o.creator.name if o.creator else None,
        "target_worker_id": o.target_worker_id,
        "target_worker_name": (o.target_worker.full_name
                               if o.target_worker else None),
        "accepted_worker_id": o.accepted_worker_id,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "shift": shift_out(s) if s else None,
    }


def _offer_targets(db: OrmSession, org_id: int,
                   target_worker_id: int | None) -> list[User]:
    q = db.query(User).filter(
        User.org_id == org_id, User.worker_id != None,
        User.is_active == True)
    if target_worker_id:
        q = q.filter(User.worker_id == target_worker_id)
    return q.all()


@router.post("/shifts/{sid}/offers")
def create_offer(sid: int, body: OfferIn,
                 user: User = Depends(get_current_user),
                 db: OrmSession = Depends(get_db)):
    s = _get_shift(db, sid, user.org_id)
    if s.status in ("cancelled", "completed"):
        raise HTTPException(400, f"Shift is {s.status}")
    is_manager = user.role in MANAGERS
    if is_manager:
        kind = "offer"
    else:
        if s.worker_id != user.worker_id:
            raise HTTPException(403, "You can only swap your own shifts")
        kind = "swap"
    if body.target_worker_id == s.worker_id:
        raise HTTPException(400, "Worker already has this shift")
    if body.target_worker_id:
        w = db.get(Worker, body.target_worker_id)
        if not w or w.org_id != user.org_id:
            raise HTTPException(400, "Unknown worker")
    o = ShiftOffer(org_id=user.org_id, shift_id=s.id, kind=kind,
                   created_by=user.id, target_worker_id=body.target_worker_id)
    db.add(o)
    db.flush()
    who = f"{s.date} {s.start_time}-{s.end_time} · {s.participant.full_name}"
    for u in _offer_targets(db, s.org_id, body.target_worker_id):
        if u.id == user.id:
            continue
        title = (f"Shift swap: {user.name} needs cover"
                 if kind == "swap" else "You're offered a shift")
        notify(db, s.org_id, u.id, "shift_offer", title, who, "/today")
    audit(db, user, "create", "shift_offer", o.id, kind)
    db.commit()
    return {"offer": offer_out(o)}


@router.get("/offers")
def list_offers(user: User = Depends(get_current_user),
                db: OrmSession = Depends(get_db)):
    q = db.query(ShiftOffer).options(
        joinedload(ShiftOffer.shift).joinedload(Shift.worker),
        joinedload(ShiftOffer.shift).joinedload(Shift.participant),
        joinedload(ShiftOffer.creator), joinedload(ShiftOffer.target_worker),
    ).filter(ShiftOffer.org_id == user.org_id)
    if user.role == "worker":
        # pending offers aimed at me or broadcast, on shifts I don't own
        q = q.filter(
            ShiftOffer.status == "pending",
            (ShiftOffer.target_worker_id == user.worker_id) |
            (ShiftOffer.target_worker_id == None),
        ).join(Shift, ShiftOffer.shift_id == Shift.id).filter(
            Shift.worker_id != user.worker_id)
    offers = q.order_by(ShiftOffer.id.desc()).limit(100).all()
    return {"offers": [offer_out(o) for o in offers]}


@router.post("/offers/{oid}/accept")
def accept_offer(oid: int, user: User = Depends(get_current_user),
                 db: OrmSession = Depends(get_db)):
    o = db.query(ShiftOffer).options(
        joinedload(ShiftOffer.shift).joinedload(Shift.worker),
        joinedload(ShiftOffer.shift).joinedload(Shift.participant),
        joinedload(ShiftOffer.creator), joinedload(ShiftOffer.target_worker),
    ).get(oid)
    if not o or o.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    if o.status != "pending":
        raise HTTPException(400, f"Offer is {o.status}")
    wid = _worker_for_user(user)
    if o.target_worker_id and o.target_worker_id != wid:
        raise HTTPException(403, "This offer wasn't for you")
    s = o.shift
    if s.status in ("cancelled", "completed"):
        raise HTTPException(400, f"Shift is {s.status}")
    if s.worker_id == wid:
        raise HTTPException(400, "You already have this shift")
    if o.kind == "offer" and s.worker_id and o.target_worker_id is None:
        pass  # broadcast offer for a covered shift — still fine to take over
    giver = s.worker
    s.worker_id = wid
    if s.status == "unfilled":
        s.status = "scheduled"
    o.status = "accepted"
    o.accepted_worker_id = wid
    o.responded_at = datetime.utcnow()
    others = db.query(ShiftOffer).filter(
        ShiftOffer.shift_id == s.id, ShiftOffer.status == "pending",
        ShiftOffer.id != o.id).all()
    for other in others:
        other.status = "filled"
        other.responded_at = datetime.utcnow()
    who = f"{s.date} {s.start_time}-{s.end_time} · {s.participant.full_name}"
    notify_managers(db, s.org_id, "offer_accepted",
                    f"{user.name} took the shift on {who}", None,
                    "/roster", exclude_user_id=user.id)
    gu = worker_user(db, giver.id if giver else None)
    if gu and gu.id != user.id:
        notify(db, s.org_id, gu.id, "shift_covered",
               f"{user.name} picked up your shift on {who}", None, "/today")
    if o.created_by != user.id and (not gu or o.created_by != gu.id):
        notify(db, s.org_id, o.created_by, "offer_accepted",
               f"{user.name} accepted your offer for {who}", None, "/today")
    audit(db, user, "accept", "shift_offer", oid)
    db.commit()
    return {"offer": offer_out(o), "shift": shift_out(s)}


@router.post("/offers/{oid}/decline")
def decline_offer(oid: int, user: User = Depends(get_current_user),
                  db: OrmSession = Depends(get_db)):
    o = db.get(ShiftOffer, oid)
    if not o or o.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    if o.status != "pending":
        raise HTTPException(400, f"Offer is {o.status}")
    wid = _worker_for_user(user)
    if o.target_worker_id and o.target_worker_id != wid:
        raise HTTPException(403, "This offer wasn't for you")
    o.status = "declined"
    o.responded_at = datetime.utcnow()
    if o.created_by != user.id:
        notify(db, o.org_id, o.created_by, "offer_declined",
               f"{user.name} declined a shift offer",
               None, "/today" if o.kind == "swap" else "/roster")
    audit(db, user, "decline", "shift_offer", oid)
    db.commit()
    return {"offer": offer_out(o)}


@router.post("/offers/{oid}/withdraw")
def withdraw_offer(oid: int, user: User = Depends(get_current_user),
                   db: OrmSession = Depends(get_db)):
    o = db.get(ShiftOffer, oid)
    if not o or o.org_id != user.org_id:
        raise HTTPException(404, "Not found")
    if o.created_by != user.id and user.role not in MANAGERS:
        raise HTTPException(403, "Not your offer")
    if o.status != "pending":
        raise HTTPException(400, f"Offer is {o.status}")
    o.status = "withdrawn"
    o.responded_at = datetime.utcnow()
    audit(db, user, "withdraw", "shift_offer", oid)
    db.commit()
    return {"offer": offer_out(o)}


# ---------- timesheets ----------

@router.get("/timesheets")
def list_timesheets(start: date | None = None, end: date | None = None,
                    user: User = Depends(get_current_user),
                    db: OrmSession = Depends(get_db)):
    q = db.query(Timesheet).join(Shift, Timesheet.shift_id == Shift.id) \
        .filter(Shift.org_id == user.org_id)
    if user.role == "worker":
        q = q.filter(Timesheet.worker_id == user.worker_id)
    if start:
        q = q.filter(Timesheet.date >= start)
    if end:
        q = q.filter(Timesheet.date <= end)
    rows = q.order_by(Timesheet.date.desc()).limit(500).all()
    return {"timesheets": [{
        "id": t.id, "shift_id": t.shift_id, "worker_id": t.worker_id,
        "participant_id": t.participant_id, "date": t.date.isoformat(),
        "scheduled_start": t.scheduled_start, "scheduled_end": t.scheduled_end,
        "check_in_at": t.check_in_at.isoformat() if t.check_in_at else None,
        "check_out_at": t.check_out_at.isoformat() if t.check_out_at else None,
        "hours": t.hours, "status": t.status,
    } for t in rows]}


@router.post("/timesheets/{tid}/status")
def set_timesheet_status(tid: int, status: str = Query(...),
                         user: User = Depends(require_roles(*MANAGERS)),
                         db: OrmSession = Depends(get_db)):
    if status not in ("pending", "confirmed", "approved", "rejected"):
        raise HTTPException(400, "Invalid status")
    t = db.get(Timesheet, tid)
    if not t:
        raise HTTPException(404, "Not found")
    t.status = status
    audit(db, user, "update", "timesheet", tid, status)
    db.commit()
    return {"ok": True}
