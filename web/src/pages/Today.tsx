import { useEffect, useState } from "react";

import { useAuth } from "../App";
import { get, pendingQueue, post, postOrQueue } from "../lib/api";
import {
  Participant, Shift, ShiftNote, ShiftOffer, todayISO, Worker,
} from "../lib/types";
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
  const [offerOpen, setOfferOpen] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [queued, setQueued] = useState(false);

  const loadNotes = () =>
    get<{ notes: ShiftNote[] }>(`/api/shifts/${s.id}/notes`)
      .then((r) => setNotes(r.notes)).catch(() => {});

  useEffect(() => { loadNotes(); }, [s.id]);

  async function punch(kind: "check-in" | "check-out") {
    setBusy(true);
    const g = await geo();
    const r = await postOrQueue(`/api/shifts/${s.id}/${kind}`, g)
      .catch((e) => { alert(e.message); return undefined; });
    if (r === null) setQueued(true);
    setBusy(false);
    onDone();
  }

  async function saveNote(submit: boolean) {
    if (!noteText.trim()) return;
    const r = await postOrQueue(`/api/shifts/${s.id}/notes`, {
      body: noteText, submit, restricted,
    }).catch((e) => { alert(e.message); return undefined; });
    if (r === null) setQueued(true);
    if (r !== undefined) { setNoteText(""); setRestricted(false); }
    loadNotes();
  }

  async function toggleTask(tid: number) {
    await post(`/api/tasks/${tid}/toggle`).catch(() => {});
    onDone();
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

      {queued && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          📶 Offline — saved locally, will send when back online
        </div>
      )}

      {s.tasks?.length > 0 && (
        <div className="mt-3 rounded-xl bg-teal-50 p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-teal-800">
            Shift tasks · {s.tasks.filter((t) => t.done).length}/{s.tasks.length}
          </div>
          {s.tasks.map((t) => (
            <label key={t.id}
              className="flex cursor-pointer items-center gap-2 py-1 text-sm">
              <input type="checkbox" checked={t.done}
                onChange={() => toggleTask(t.id)}
                className="h-4 w-4 accent-teal-600" />
              <span className={t.done ? "text-slate-400 line-through" : ""}>
                {t.label}
              </span>
            </label>
          ))}
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
        <button className="text-teal-700 hover:underline"
          onClick={() => setShowNotes(!showNotes)}>
          Notes ({notes.length})
        </button>
        <button className="text-teal-700 hover:underline"
          onClick={() => setExpanded(!expanded)}>
          Client info
        </button>
        {["scheduled", "confirmed"].includes(s.status) && (
          <button className="text-teal-700 hover:underline"
            onClick={() => setOfferOpen(true)}>
            Need a swap?
          </button>
        )}
        <EmergencyButton pid={s.participant_id} />
      </div>

      {offerOpen && (
        <SwapPicker sid={s.id} onDone={() => { setOfferOpen(false); onDone(); }} />
      )}

      {expanded && <ParticipantBrief id={s.participant_id} />}

      {showNotes && (
        <div className="mt-3 border-t pt-3">
          {notes.map((n) => (
            <div key={n.id} className="mb-2 rounded bg-slate-50 p-2 text-sm">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>{n.worker_name ?? "You"} · v{n.version}</span>
                <Badge tone={statusTone(n.status)}>{n.status}</Badge>
              </div>
              {n.restricted && (
                <span className="mr-1 rounded bg-rose-100 px-1 text-[10px] text-rose-700">
                  managers only
                </span>
              )}
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
          <label className="mb-2 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={restricted}
              onChange={(e) => setRestricted(e.target.checked)}
              className="accent-teal-600" />
            🔒 Managers only (restricted)
          </label>
          <div className="flex gap-2">
            <Btn kind="ghost" onClick={() => saveNote(false)}>Save draft</Btn>
            <Btn onClick={() => saveNote(true)}>Submit note</Btn>
          </div>
        </div>
      )}
    </Card>
  );
}

function SwapPicker({ sid, onDone }: { sid: number; onDone: () => void }) {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [target, setTarget] = useState("");

  useEffect(() => {
    get<{ workers: Worker[] }>("/api/workers")
      .then((r) => setWorkers(r.workers.filter((w) => w.id !== user?.worker_id)))
      .catch(() => {});
  }, []);

  const send = async () => {
    await post(`/api/shifts/${sid}/offers`, {
      target_worker_id: target ? +target : null,
    });
    onDone();
  };

  return (
    <div className="mt-3 rounded-xl bg-teal-50 p-3">
      <p className="mb-2 text-sm font-medium text-teal-900">
        Ask someone to take this shift
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-lg border border-teal-200 bg-white px-2 py-1.5 text-sm"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">Any worker (broadcast)</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.full_name}</option>
          ))}
        </select>
        <Btn onClick={send}>Send request</Btn>
        <Btn kind="ghost" onClick={onDone}>Cancel</Btn>
      </div>
    </div>
  );
}

function OffersSection({ onDone }: { onDone: () => void }) {
  const [offers, setOffers] = useState<ShiftOffer[]>([]);

  const load = () =>
    get<{ offers: ShiftOffer[] }>("/api/offers")
      .then((r) => setOffers(r.offers)).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  const act = async (o: ShiftOffer, verb: "accept" | "decline") => {
    await post(`/api/offers/${o.id}/${verb}`).catch((e) => alert(e.message));
    load();
    onDone();
  };

  if (!offers.length) return null;
  return (
    <Card className="mb-4 border-amber-200 bg-amber-50">
      <h2 className="mb-2 font-semibold text-amber-900">
        🔔 Shift offers ({offers.length})
      </h2>
      <div className="space-y-2">
        {offers.map((o) => (
          <div key={o.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white p-3 text-sm">
            <div>
              <div className="font-medium">
                {o.shift ? `${o.shift.date} ${o.shift.start_time}–${o.shift.end_time}` : ""}
                {" · "}{o.shift?.participant_name}
              </div>
              <div className="text-xs text-slate-500">
                {o.kind === "swap"
                  ? `${o.creator_name} needs cover`
                  : o.target_worker_id
                    ? `Offered by ${o.creator_name}`
                    : `Open shift · posted by ${o.creator_name}`}
                {o.shift?.location ? ` · ${o.shift.location}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <Btn kind="success" onClick={() => act(o, "accept")}>Take it</Btn>
              <Btn kind="ghost" onClick={() => act(o, "decline")}>Decline</Btn>
            </div>
          </div>
        ))}
      </div>
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

function EmergencyButton({ pid }: { pid: number }) {
  const [info, setInfo] = useState<Record<string, string | null> | null>(null);
  const go = async () => {
    const reason = prompt("Reason for emergency access? (logged)") ?? "";
    if (reason.trim().length < 5) return;
    const r = await get<{ emergency: any }>(
      `/api/participants/${pid}/emergency?reason=${encodeURIComponent(reason)}`)
      .catch((e) => { alert(e.message); return null; });
    if (r) setInfo(r.emergency);
  };
  return (
    <>
      <button className="text-rose-600 hover:underline" onClick={go}>
        🚨 Emergency info
      </button>
      {info && (
        <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm">
          <div className="mb-1 text-xs font-medium uppercase text-rose-700">
            Emergency access (logged)
          </div>
          {Object.entries(info).filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="mb-1">
              <b>{k.replace(/_/g, " ")}:</b> {String(v)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function QueueChip() {
  const [n, setN] = useState(pendingQueue().length);
  useEffect(() => {
    const f = () => setN(pendingQueue().length);
    window.addEventListener("offline-queue-changed", f);
    window.addEventListener("online", f);
    return () => {
      window.removeEventListener("offline-queue-changed", f);
      window.removeEventListener("online", f);
    };
  }, []);
  if (!n) return null;
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
      📶 {n} queued offline
    </span>
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
      <div className="mb-2 flex justify-end"><QueueChip /></div>
      {isWorker && <OffersSection onDone={load} />}
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
        className="mb-4 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" />
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
