from datetime import date as date_type
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    email: str
    password: str


class ParticipantIn(BaseModel):
    full_name: str
    preferred_name: str | None = None
    date_of_birth: date_type | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    guardian: str | None = None
    communication_prefs: str | None = None
    ndis_number: str | None = None
    plan_start: date_type | None = None
    plan_end: date_type | None = None
    support_coordinator: str | None = None
    plan_manager: str | None = None
    support_needs: str | None = None
    routines: str | None = None
    mobility_info: str | None = None
    risks: str | None = None
    allergies: str | None = None
    medical_info: str | None = None
    medications: str | None = None
    emergency_info: str | None = None


class AvailabilityIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    kind: str = "available"


class QualificationIn(BaseModel):
    name: str
    issued_on: date_type | None = None
    expires_on: date_type | None = None


class WorkerIn(BaseModel):
    full_name: str
    preferred_name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    position: str | None = None
    employment_status: str | None = None
    start_date: date_type | None = None
    skills: str | None = None
    notes: str | None = None
    availability: list[AvailabilityIn] = []
    qualifications: list[QualificationIn] = []


class ShiftIn(BaseModel):
    worker_id: int | None = None
    participant_id: int
    date: date_type
    start_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(pattern=r"^\d{2}:\d{2}$")
    location: str | None = None
    service_type: str | None = None
    instructions: str | None = None
    required_skills: str | None = None


class ShiftUpdate(BaseModel):
    worker_id: int | None = None
    participant_id: int | None = None
    date: date_type | None = None
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    service_type: str | None = None
    instructions: str | None = None
    required_skills: str | None = None
    status: str | None = None


class CheckInOutIn(BaseModel):
    lat: float | None = None
    lng: float | None = None
    accuracy_m: float | None = None


class OfferIn(BaseModel):
    target_worker_id: int | None = None  # None = broadcast to all workers


class CancelIn(BaseModel):
    reason: str | None = None


class NoteIn(BaseModel):
    body: str
    restricted: bool = False
    submit: bool = False


class IncidentIn(BaseModel):
    participant_id: int
    occurred_at: datetime
    location: str | None = None
    people_involved: str | None = None
    category: str | None = None
    severity: str = "medium"
    description: str
    actions_taken: str | None = None
    follow_up: str | None = None


class IncidentUpdate(BaseModel):
    status: str | None = None
    follow_up: str | None = None
    severity: str | None = None


class RequestIn(BaseModel):
    kind: str = "general"
    body: str
    participant_id: int | None = None


class RequestUpdate(BaseModel):
    status: str | None = None
    response: str | None = None
    assigned_to: int | None = None


class MessageIn(BaseModel):
    recipient_id: int
    body: str = Field(min_length=1, max_length=4000)


class PostIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=10000)
    pinned: bool = False


class UserIn(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=8)
    role: str
    worker_id: int | None = None
    participant_id: int | None = None
