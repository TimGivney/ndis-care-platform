"""Seed a demo organisation so the app is usable from first boot."""
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session as OrmSession

from .auth import hash_password
from .models import (
    ClientRequest, Incident, Organisation, Participant, Qualification, Shift,
    ShiftTask, User, Worker, WorkerAvailability,
)

DEMO_PASSWORD = "demo1234"


def seed_if_empty(db: OrmSession) -> None:
    if db.query(Organisation).first():
        return

    org = Organisation(name="Demo Care Co", abn="12 345 678 901",
                       phone="02 5555 0100", email="hello@democare.example",
                       address="1 Example St, Sydney NSW 2000")
    db.add(org)
    db.flush()

    participants = [
        Participant(org_id=org.id, full_name="John Smith", preferred_name="Johnno",
                    date_of_birth=date(1985, 3, 12), phone="0412 000 111",
                    address="14 Banksia Ave, Marrickville NSW",
                    emergency_contact="Mary Smith (sister) 0412 000 112",
                    ndis_number="430 123 456", plan_start=date(2026, 1, 1),
                    plan_end=date(2026, 12, 31),
                    support_coordinator="Lisa Tran, Connect Coordination",
                    support_needs="Community access, shopping, social outings",
                    routines="Prefers morning showers; likes coffee at 10am",
                    mobility_info="Independent mobility; tires on long walks",
                    risks="Can become anxious in crowded places",
                    allergies="Peanuts", medications="Vitamin D daily"),
        Participant(org_id=org.id, full_name="Mary Jones",
                    date_of_birth=date(1972, 7, 30), phone="0412 000 222",
                    address="8 Ironbark Cres, Dulwich Hill NSW",
                    emergency_contact="Peter Jones (son) 0412 000 223",
                    ndis_number="430 234 567", plan_start=date(2025, 11, 1),
                    plan_end=date(2026, 10, 31),
                    support_needs="Personal care, meal prep, transport",
                    mobility_info="Uses wheelchair; full transfer assistance",
                    medical_info="Type 2 diabetes - check glucose before meals",
                    medications="Metformin 500mg morning and evening"),
        Participant(org_id=org.id, full_name="Peter Nguyen", preferred_name="Pete",
                    date_of_birth=date(1998, 1, 5), phone="0412 000 333",
                    address="22 Waratah St, Newtown NSW",
                    emergency_contact="Anna Nguyen (mother) 0412 000 334",
                    ndis_number="430 345 678", plan_start=date(2026, 2, 15),
                    plan_end=date(2027, 2, 14),
                    support_needs="Supported independent living, skill building",
                    communication_prefs="Visual schedule; short clear sentences",
                    routines="Swimming Thursday 4pm - loves it"),
        Participant(org_id=org.id, full_name="Grace Williams",
                    date_of_birth=date(1960, 9, 18), phone="0412 000 444",
                    address="3 Fig Tree Ln, Balmain NSW",
                    emergency_contact="Sam Williams (husband) 0412 000 445",
                    ndis_number="430 456 789", plan_start=date(2026, 4, 1),
                    plan_end=date(2027, 3, 31),
                    support_needs="Domestic assistance, gardening",
                    allergies="Penicillin", risks="Fall risk on stairs"),
    ]
    db.add_all(participants)
    db.flush()

    def worker(name, phone, pos, skills, quals, avail):
        w = Worker(org_id=org.id, full_name=name, phone=phone, position=pos,
                   employment_status="permanent", start_date=date(2025, 6, 1),
                   skills=skills)
        for q in quals:
            w.qualifications.append(Qualification(**q))
        for a in avail:
            w.availability.append(WorkerAvailability(**a))
        return w

    week_avail = [dict(weekday=d, start_time="07:00", end_time="18:00")
                  for d in range(5)]
    workers = [
        worker("Sarah Chen", "0400 100 001", "Support Worker",
               "Manual handling, meal prep, community access",
               [{"name": "First Aid", "expires_on": date(2027, 5, 1)},
                {"name": "WWCC", "expires_on": date(2029, 1, 15)},
                {"name": "Medication prompting", "expires_on": date(2026, 11, 1)}],
               week_avail + [dict(weekday=5, start_time="09:00", end_time="15:00")]),
        worker("Dave Kumar", "0400 100 002", "Support Worker",
               "Behaviour support, SIL, transport",
               [{"name": "First Aid", "expires_on": date(2026, 10, 20)},
                {"name": "WWCC", "expires_on": date(2028, 8, 1)},
                {"name": "Police Check", "expires_on": date(2027, 2, 1)}],
               [dict(weekday=d, start_time="08:00", end_time="20:00")
                for d in range(7)]),
        worker("Lisa O'Brien", "0400 100 003", "Senior Support Worker",
               "High intensity support, diabetes management",
               [{"name": "First Aid", "expires_on": date(2026, 10, 15)},
                {"name": "WWCC", "expires_on": date(2029, 3, 1)},
                {"name": "Diabetes management", "expires_on": date(2026, 12, 1)}],
               [dict(weekday=d, start_time="06:00", end_time="14:00")
                for d in range(5)]),
        worker("Michael Rossi", "0400 100 004", "Support Worker",
               "Gardening, domestic, driving",
               [{"name": "First Aid", "expires_on": date(2027, 1, 10)},
                {"name": "WWCC", "expires_on": date(2030, 6, 1)}],
               [dict(weekday=d, start_time="09:00", end_time="17:00")
                for d in (1, 2, 3, 4)]),
    ]
    db.add_all(workers)
    db.flush()

    today = date.today()
    monday = today - timedelta(days=today.weekday())

    ITEM_CODES = {
        "Community access": "04_104_0125_6_1",
        "Personal care": "01_011_0107_1_1",
        "SIL support": "01_801_0115_1_1",
        "Meal prep": "01_022_0120_1_1",
        "Respite": "01_051_0115_1_1",
    }

    def sh(d_off, w, p, st, en, svc, loc=None, status="scheduled", tasks=()):
        s = Shift(org_id=org.id, worker_id=w.id if w else None,
                  participant_id=p.id, date=monday + timedelta(days=d_off),
                  start_time=st, end_time=en, service_type=svc,
                  location=loc or p.address, status=status,
                  instructions="See support plan before starting.",
                  support_item_code=ITEM_CODES.get(svc))
        for label in tasks:
            s.tasks.append(ShiftTask(org_id=org.id, label=label))
        return s

    shifts = [
        sh(0, workers[0], participants[0], "09:00", "12:00", "Community access",
           status="completed" if today.weekday() > 0 else "scheduled"),
        sh(0, workers[2], participants[1], "08:00", "10:00", "Personal care",
           tasks=("Check glucose before breakfast", "Meds prompted",
                  "Shower assistance")),
        sh(0, workers[1], participants[2], "10:30", "13:00", "SIL support",
           tasks=("Visual schedule reviewed", "Skill practice 30 min")),
        sh(1, workers[0], participants[1], "09:00", "11:00", "Meal prep",
           tasks=("Meal prepared", "Kitchen tidied")),
        sh(1, workers[1], participants[2], "15:30", "18:00", "Swimming",
           "Newtown Pool"),
        sh(1, workers[3], participants[3], "10:00", "13:00", "Gardening"),
        sh(2, workers[0], participants[0], "09:00", "12:00", "Shopping"),
        sh(2, None, participants[1], "14:00", "16:00", "Respite", status="unfilled"),
        sh(3, workers[2], participants[1], "08:00", "10:00", "Personal care"),
        sh(3, workers[1], participants[2], "10:00", "14:00", "Skill building"),
        sh(4, workers[0], participants[0], "09:30", "12:30", "Community access"),
        sh(4, workers[3], participants[3], "10:00", "12:00", "Domestic"),
        sh(5, workers[0], participants[2], "10:00", "14:00", "Community access"),
        sh(6, None, participants[0], "10:00", "12:00", "Community access",
           status="unfilled"),
    ]
    db.add_all(shifts)

    users = [
        User(org_id=org.id, email="admin@demo.care", name="Ada Admin",
             role="admin", password_hash=hash_password(DEMO_PASSWORD)),
        User(org_id=org.id, email="manager@demo.care", name="Mike Manager",
             role="manager", password_hash=hash_password(DEMO_PASSWORD)),
        User(org_id=org.id, email="sarah@demo.care", name="Sarah Chen",
             role="worker", worker_id=workers[0].id,
             password_hash=hash_password(DEMO_PASSWORD)),
        User(org_id=org.id, email="dave@demo.care", name="Dave Kumar",
             role="worker", worker_id=workers[1].id,
             password_hash=hash_password(DEMO_PASSWORD)),
        User(org_id=org.id, email="john@demo.care", name="John Smith",
             role="participant", participant_id=participants[0].id,
             password_hash=hash_password(DEMO_PASSWORD)),
    ]
    db.add_all(users)
    db.flush()

    db.add(Incident(org_id=org.id, participant_id=participants[1].id,
                    reported_by=users[0].id,
                    occurred_at=datetime.utcnow() - timedelta(days=2),
                    location="Kitchen", category="Medication",
                    severity="medium",
                    description="Participant missed evening medication; "
                                "reminded and taken 1 hour late.",
                    actions_taken="Notified manager; medication taken late.",
                    follow_up="Review prompting routine", status="in_review"))
    db.add(ClientRequest(org_id=org.id, participant_id=participants[0].id,
                         kind="schedule_change",
                         body="Can I move my Friday support to the afternoon "
                              "this week? Doctor appointment in the morning."))
    db.commit()
