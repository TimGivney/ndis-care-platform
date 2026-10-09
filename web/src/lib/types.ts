export interface Participant {
  id: number;
  full_name: string;
  preferred_name: string | null;
  phone: string | null;
  is_active: boolean;
  ndis_number: string | null;
  plan_end: string | null;
  date_of_birth?: string | null;
  email?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  guardian?: string | null;
  communication_prefs?: string | null;
  plan_start?: string | null;
  support_coordinator?: string | null;
  plan_manager?: string | null;
  support_needs?: string | null;
  routines?: string | null;
  mobility_info?: string | null;
  risks?: string | null;
  allergies?: string | null;
  medical_info?: string | null;
  medications?: string | null;
  emergency_info?: string | null;
}

export interface Availability {
  id?: number;
  weekday: number;
  start_time: string;
  end_time: string;
  kind: string;
}

export interface Qualification {
  id?: number;
  name: string;
  issued_on: string | null;
  expires_on: string | null;
}

export interface Worker {
  id: number;
  full_name: string;
  preferred_name: string | null;
  phone: string | null;
  position: string | null;
  is_active: boolean;
  email?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  employment_status?: string | null;
  start_date?: string | null;
  skills?: string | null;
  notes?: string | null;
  availability?: Availability[];
  qualifications?: Qualification[];
}

export interface Shift {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  service_type: string | null;
  instructions: string | null;
  required_skills: string | null;
  status: string;
  worker_id: number | null;
  worker_name: string | null;
  participant_id: number;
  participant_name: string | null;
  cancel_reason: string | null;
}

export interface ShiftNote {
  id: number;
  shift_id: number;
  worker_id: number;
  participant_id: number;
  body: string;
  status: string;
  version: number;
  restricted: boolean;
  submitted_at: string | null;
  created_at: string | null;
  participant_name: string | null;
  worker_name: string | null;
}

export interface Incident {
  id: number;
  participant_id: number;
  participant_name: string | null;
  occurred_at: string;
  location: string | null;
  people_involved: string | null;
  category: string | null;
  severity: string;
  description: string;
  actions_taken: string | null;
  follow_up: string | null;
  status: string;
  reported_by: number;
  created_at: string | null;
}

export interface ClientRequest {
  id: number;
  participant_id: number;
  participant_name: string | null;
  kind: string;
  body: string;
  status: string;
  assigned_to: number | null;
  response: string | null;
  created_at: string | null;
}

export interface Timesheet {
  id: number;
  shift_id: number;
  worker_id: number;
  participant_id: number;
  date: string;
  scheduled_start: string;
  scheduled_end: string;
  check_in_at: string | null;
  check_out_at: string | null;
  hours: number | null;
  status: string;
}

export interface Dashboard {
  todays_shifts: number;
  unfilled: { id: number; participant_name: string; start_time: string }[];
  missed_checkins: {
    id: number;
    worker_name: string | null;
    participant_name: string;
    start_time: string;
  }[];
  notes_pending_review?: number;
  open_incidents?: number;
  open_requests?: number;
  expiring_certs?: {
    id: number;
    name: string;
    worker_name: string;
    expires_on: string;
  }[];
}

export interface AuditEntry {
  id: number;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: number | null;
  detail: string | null;
  at: string | null;
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function todayISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
