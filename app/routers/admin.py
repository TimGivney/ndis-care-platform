import csv
import io
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session as OrmSession, joinedload

from ..auth import MANAGERS, audit, get_current_user, require_roles
from ..db import get_db
from ..models import (
    Incident, Organisation, Participant, Shift, ShiftNote, Timesheet, User,
)
from ..schemas import OrgIn, PrefsIn

router = APIRouter(prefix="/api", tags=["admin"])


# ---------- org settings ----------

@router.get("/org")
def get_org(user: User = Depends(get_current_user),
            db: OrmSession = Depends(get_db)):
    o = db.get(Organisation, user.org_id)
    return {"org": {
        "id": o.id, "name": o.name, "abn": o.abn, "phone": o.phone,
        "email": o.email, "address": o.address}}


@router.put("/org")
def update_org(body: OrgIn,
               user: User = Depends(require_roles(*MANAGERS)),
               db: OrmSession = Depends(get_db)):
    o = db.get(Organisation, user.org_id)
    for k, v in body.model_dump().items():
        setattr(o, k, v)
    audit(db, user, "update", "organisation", o.id)
    db.commit()
    return {"org": {"id": o.id, "name": o.name}}


# ---------- user prefs (quiet hours) ----------

@router.put("/me/prefs")
def update_prefs(body: PrefsIn, user: User = Depends(get_current_user),
                 db: OrmSession = Depends(get_db)):
    user.quiet_start = body.quiet_start
    user.quiet_end = body.quiet_end
    db.commit()
    return {"ok": True, "quiet_start": user.quiet_start,
            "quiet_end": user.quiet_end}


# ---------- break-glass emergency access ----------

@router.get("/participants/{pid}/emergency")
def emergency_access(pid: int, reason: str = Query(..., min_length=5),
                     user: User = Depends(get_current_user),
                     db: OrmSession = Depends(get_db)):
    p = db.get(Participant, pid)
    if not p or p.org_id != user.org_id or p.deleted:
        raise HTTPException(404, "Not found")
    if user.role == "participant":
        raise HTTPException(403, "Not allowed")
    audit(db, user, "break_glass", "participant", pid,
          f"{p.full_name} — reason: {reason}")
    db.commit()
    return {"emergency": {
        "full_name": p.full_name, "phone": p.phone, "address": p.address,
        "emergency_contact": p.emergency_contact, "guardian": p.guardian,
        "risks": p.risks, "allergies": p.allergies,
        "medical_info": p.medical_info, "medications": p.medications,
        "emergency_info": p.emergency_info}}


# ---------- CSV exports ----------

def _csv(rows: list[list], header: list[str], filename: str):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(header)
    w.writerows(rows)
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/reports/shifts.csv")
def shifts_csv(start: date = Query(...), end: date = Query(...),
               user: User = Depends(require_roles(*MANAGERS)),
               db: OrmSession = Depends(get_db)):
    shifts = db.query(Shift).options(
        joinedload(Shift.worker), joinedload(Shift.participant),
        joinedload(Shift.tasks),
    ).filter(Shift.org_id == user.org_id,
             Shift.date >= start, Shift.date <= end) \
     .order_by(Shift.date, Shift.start_time).all()
    rows = [[
        s.date.isoformat(), s.start_time, s.end_time,
        s.worker.full_name if s.worker else "",
        s.participant.full_name if s.participant else "",
        s.service_type or "", s.support_item_code or "",
        s.location or "", s.status,
        f"{sum(t.done for t in s.tasks)}/{len(s.tasks)}",
        s.cancel_reason or "",
    ] for s in shifts]
    audit(db, user, "export", "report", None, f"shifts {start}..{end}")
    db.commit()
    return _csv(rows, ["date", "start", "end", "worker", "participant",
                       "service_type", "support_item_code", "location",
                       "status", "tasks_done", "cancel_reason"],
                f"shifts_{start}_{end}.csv")


@router.get("/reports/timesheets.csv")
def timesheets_csv(start: date = Query(...), end: date = Query(...),
                   user: User = Depends(require_roles(*MANAGERS)),
                   db: OrmSession = Depends(get_db)):
    rows_q = db.query(Timesheet).join(Shift, Timesheet.shift_id == Shift.id) \
        .filter(Shift.org_id == user.org_id,
                Timesheet.date >= start, Timesheet.date <= end) \
        .order_by(Timesheet.date).all()
    from ..models import Participant as P, Worker as W
    rows = []
    for t in rows_q:
        w = db.get(W, t.worker_id)
        p = db.get(P, t.participant_id)
        rows.append([
            t.date.isoformat(), w.full_name if w else t.worker_id,
            p.full_name if p else t.participant_id,
            t.scheduled_start, t.scheduled_end,
            t.check_in_at.isoformat() if t.check_in_at else "",
            t.check_out_at.isoformat() if t.check_out_at else "",
            t.hours or "", t.status,
        ])
    audit(db, user, "export", "report", None, f"timesheets {start}..{end}")
    db.commit()
    return _csv(rows, ["date", "worker", "participant", "sched_start",
                       "sched_end", "check_in", "check_out", "hours", "status"],
                f"timesheets_{start}_{end}.csv")


@router.get("/reports/incidents.csv")
def incidents_csv(start: date = Query(...), end: date = Query(...),
                  user: User = Depends(require_roles(*MANAGERS)),
                  db: OrmSession = Depends(get_db)):
    items = db.query(Incident).options(joinedload(Incident.participant)).filter(
        Incident.org_id == user.org_id,
        Incident.occurred_at >= start, Incident.occurred_at <= end) \
        .order_by(Incident.occurred_at).all()
    reporter = {u.id: u.name for u in db.query(User).filter(
        User.org_id == user.org_id)}
    rows = [[
        i.occurred_at.isoformat(),
        i.participant.full_name if i.participant else "",
        reporter.get(i.reported_by, ""), i.category or "", i.severity,
        i.status, i.location or "",
        i.description.replace("\n", " "),
        (i.follow_up or "").replace("\n", " "),
    ] for i in items]
    audit(db, user, "export", "report", None, f"incidents {start}..{end}")
    db.commit()
    return _csv(rows, ["occurred_at", "participant", "reported_by",
                       "category", "severity", "status", "location",
                       "description", "follow_up"],
                f"incidents_{start}_{end}.csv")


@router.get("/reports/notes.csv")
def notes_csv(start: date = Query(...), end: date = Query(...),
              user: User = Depends(require_roles(*MANAGERS)),
              db: OrmSession = Depends(get_db)):
    notes = db.query(ShiftNote).join(Shift).options(
        joinedload(ShiftNote.shift).joinedload(Shift.worker),
        joinedload(ShiftNote.shift).joinedload(Shift.participant),
    ).filter(Shift.org_id == user.org_id,
             ShiftNote.created_at >= start, ShiftNote.created_at <= end) \
     .order_by(ShiftNote.id).all()
    rows = [[
        n.created_at.date().isoformat() if n.created_at else "",
        n.shift.date.isoformat() if n.shift else "",
        n.shift.worker.full_name if n.shift and n.shift.worker else "",
        n.shift.participant.full_name if n.shift and n.shift.participant else "",
        n.status, "yes" if n.restricted else "no", n.version,
        n.body.replace("\n", " "),
    ] for n in notes]
    audit(db, user, "export", "report", None, f"notes {start}..{end}")
    db.commit()
    return _csv(rows, ["created", "shift_date", "worker", "participant",
                       "status", "restricted", "version", "body"],
                f"notes_{start}_{end}.csv")
