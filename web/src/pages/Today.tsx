import { useEffect, useState } from "react";

import { useAuth } from "../App";
import { get, post } from "../lib/api";
import { Participant, Shift, ShiftNote, todayISO } from "../lib/types";
import { Badge, Btn, Card, Page, statusTone } from "../lib/ui";

function geo(): Promise<{ lat?: number; lng?: number; accuracy_m?: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy_m: pos.coords.accuracy,
      }),
      () => resolve({}),
      { timeout: 5000 },
    );
  });
}

function ShiftCard({ s, onDone }: { s: Shift; onDone: () => void }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<ShiftNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadNotes = () =>
    get<{ notes: ShiftNote[] }>(`/api/shifts/${s.id}/notes`)
      .then((r) => setNotes(r.notes)).catch(() => {});

  useEffect(() => { loadNotes(); }, [s.id]);

  async function punch(kind: "check-in" | "check-out") {
    setBusy(true);
    const g = await geo();
    await post(`/api/shifts/${s.id}/${kind}`, g).catch((e) => alert(e.message));
    setBusy(false);
    onDone();
  }

  async function saveNote(submit: boolean) {
    if (!noteText.trim()) return;
    await post(`/api/shifts/${s.id}/notes`, { body: noteText, submit });
    setNoteText("");
    loadNotes();
  }

  const actionable = ["scheduled", "confirmed", "checked_in", "in_progress"].includes(s.status);

  return (
    <Card className={s.status === "unfilled" ? "border-red-300" : ""}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-lg font-bold">{s.start_time}–{s.end_time}</div>
          <div className="font-medium">{s.participant_name}</div>
          <div className="text-sm text-slate-500">{s.service_type}</div>
          {s.location && <div className="text-sm text-slate-500">📍 {s.location}</div>}
        </div>
        <Badge tone={statusTone(s.status)}>{s.status.replace("_", " ")}</Badge>
      </div>

      {s.instructions && (
        <div className="mt-2 rounded bg-slate-50 px-3 py-2 text-sm">
          {s.instructions}
        </div>
      )}

      {actionable && (
        <div className="mt-3 flex gap-2">
          {["scheduled", "confirmed"].includes(s.status) && (
            <Btn kind="success" className="flex-1 py-3 text-base" disabled={busy}
              onClick={() => punch("check-in")}>
              ▶ CHECK IN
            </Btn>
          )}
          {["checked_in", "in_progress"].includes(s.status) && (
            <Btn kind="danger" className="flex-1 py-3 text-base" disabled={busy}
              onClick={() => punch("check-out")}>
              ■ CHECK OUT
            </Btn>
          )}
        </div>
      )}

      <div className="mt-2 flex gap-3 text-sm">
        <button className="text-blue-600 hover:underline"
          onClick={() => setShowNotes(!showNotes)}>
          Notes ({notes.length})
        </button>
        <button className="text-blue-600 hover:underline"
          onClick={() => setExpanded(!expanded)}>
          Client info
        </button>
      </div>

      {expanded && <ParticipantBrief id={s.participant_id} />}

      {showNotes && (
        <div className="mt-3 border-t pt-3">
          {notes.map((n) => (
            <div key={n.id} className="mb-2 rounded bg-slate-50 p-2 text-sm">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>{n.worker_name ?? "You"} · v{n.version}</span>
                <Badge tone={statusTone(n.status)}>{n.status}</Badge>
              </div>
              {n.body}
            </div>
          ))}
          <textarea
            className="mb-2 w-full rounded border border-slate-300 p-2 text-sm"
            rows={3}
            placeholder="Progress note…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => saveNote(false)}>Save draft</Btn>
            <Btn onClick={() => saveNote(true)}>Submit note</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

function ParticipantBrief({ id }: { id: number }) {
  const [p, setP] = useState<Participant | null>(null);
  useEffect(() => {
    get<{ participant: Participant }>(`/api/participants/${id}`)
      .then((r) => setP(r.participant)).catch(() => {});
  }, [id]);
  if (!p) return null;
  const rows: [string, string | null | undefined][] = [
    ["Allergies", p.allergies],
    ["Risks", p.risks],
    ["Medications", p.medications],
    ["Mobility", p.mobility_info],
    ["Routines", p.routines],
    ["Emergency", p.emergency_contact],
  ];
  return (
    <div className="mt-3 rounded bg-blue-50 p-3 text-sm">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="mb-1">
          <b>{k}:</b> {v}
        </div>
      ))}
    </div>
  );
}

export default function Today() {
  const { user } = useAuth();
  const [date, setDate] = useState(todayISO());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const isWorker = user?.role === "worker";

  const load = () =>
    get<{ shifts: Shift[] }>(`/api/shifts?start=${date}&end=${date}`)
      .then((r) => setShifts(r.shifts));

  useEffect(() => { load().catch(() => {}); }, [date]);

  return (
    <Page title={isWorker ? "My shifts" : "Today's shifts"}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="mb-4 rounded border border-slate-300 px-2 py-1.5 text-sm" />
      <div className="space-y-3">
        {shifts.map((s) => <ShiftCard key={s.id} s={s} onDone={load} />)}
        {!shifts.length && (
          <Card className="text-center text-slate-500">
            No shifts scheduled for {date}.
          </Card>
        )}
      </div>
    </Page>
  );
}
