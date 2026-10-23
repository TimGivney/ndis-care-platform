import { useEffect, useState } from "react";
import {
  Bell, Check, ChevronLeft, ChevronRight, Info, MapPin, NotebookPen, Repeat,
  Siren, WifiOff,
} from "lucide-react";

import { useAuth } from "../App";
import { get, pendingQueue, post, postOrQueue } from "../lib/api";
import { Participant, Shift, ShiftNote, ShiftOffer, Worker } from "../lib/types";
import {
  addDays, Badge, Btn, Card, cardShadow, fmtDay, greeting, inputCls, isoLocal,
  Page, statusLabel, statusTone,
} from "../lib/ui";

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

type Panel = "notes" | "info" | "swap" | "sos" | null;

function ShiftCard({ s, onDone }: { s: Shift; onDone: () => void }) {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [notes, setNotes] = useState<ShiftNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);

  const loadNotes = () =>
    get<{ notes: ShiftNote[] }>(`/api/shifts/${s.id}/notes`)
      .then((r) => setNotes(r.notes)).catch(() => {});

  useEffect(() => { loadNotes(); }, [s.id]);

  async function punch(kind: "check-in" | "check-out") {
    setBusy(true);
    if (isManager) {
      const verb = kind === "check-in" ? "Check in" : "Check out";
      if (confirm(`${verb} ${s.worker_name ?? "the worker"} manually? This is logged.`)) {
        await post(`/api/shifts/${s.id}/manual-check`, {
          kind: kind === "check-in" ? "check_in" : "check_out",
          note: "Manager manual check",
        }).catch((e) => alert(e.message));
      }
    } else {
      const g = await geo();
      const r = await postOrQueue(`/api/shifts/${s.id}/${kind}`, g)
        .catch((e) => { alert(e.message); return undefined; });
      if (r === null) setQueued(true);
    }
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

  const canStart = ["scheduled", "confirmed"].includes(s.status) && (!isManager || !!s.worker_id);
  const canFinish = ["checked_in", "in_progress"].includes(s.status);
  const tasks = s.tasks ?? [];
  const done = tasks.filter((t) => t.done).length;

  const tabs: { key: Exclude<Panel, null>; label: string; icon: typeof Info }[] = [
    { key: "notes", label: notes.length ? `Notes · ${notes.length}` : "Notes", icon: NotebookPen },
    { key: "info", label: "Client", icon: Info },
    ...(["scheduled", "confirmed"].includes(s.status) && !isManager
      ? [{ key: "swap" as const, label: "Swap", icon: Repeat }] : []),
    { key: "sos", label: "SOS", icon: Siren },
  ];

  return (
    <div className={`overflow-hidden rounded-3xl bg-white ${cardShadow} ${s.status === "unfilled" ? "ring-2 ring-amber-300" : ""} ${s.status === "cancelled" ? "opacity-60" : ""}`}>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-slate-500">
              {s.start_time} – {s.end_time}{s.service_type ? ` · ${s.service_type}` : ""}
            </div>
            <div className="mt-0.5 truncate text-xl font-semibold tracking-tight text-slate-900">
              {s.participant_name}
            </div>
            {isManager && (
              <div className="text-sm text-slate-500">
                {s.worker_name ?? <span className="font-medium text-amber-600">Unfilled</span>}
              </div>
            )}
            {s.location && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(s.location)}`}
                target="_blank" rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-sm text-teal-700 hover:underline">
                <MapPin size={14} /> {s.location}
              </a>
            )}
          </div>
          <Badge tone={statusTone(s.status)}>{statusLabel(s.status)}</Badge>
        </div>

        {s.instructions && (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {s.instructions}
          </p>
        )}

        {queued && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            <WifiOff size={14} /> No signal — saved on your phone, will send automatically
          </div>
        )}

        {tasks.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[13px] font-medium text-slate-500">
              <span>Tasks</span>
              <span>{done} of {tasks.length}</span>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${(done / tasks.length) * 100}%` }} />
            </div>
            <div className="space-y-1.5">
              {tasks.map((t) => (
                <button key={t.id} onClick={() => toggleTask(t.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${t.done ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700 hover:bg-slate-100"}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
                    {t.done && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className={t.done ? "line-through decoration-emerald-400" : ""}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {(canStart || canFinish) && (
          <button disabled={busy}
            onClick={() => punch(canStart ? "check-in" : "check-out")}
            className={`mt-4 flex h-14 w-full items-center justify-center rounded-2xl text-base font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50 ${canStart ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-800 hover:bg-slate-900"}`}>
            {busy ? "One moment…"
              : canStart ? (isManager ? "Check in for worker" : "Check in")
                : (isManager ? "Check out for worker" : "Check out")}
          </button>
        )}
      </div>

      <div className="flex border-t border-slate-100">
        {tabs.map((t) => {
          const on = panel === t.key;
          const sos = t.key === "sos";
          return (
            <button key={t.key} onClick={() => setPanel(on ? null : t.key)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition ${on ? (sos ? "bg-rose-50 text-rose-600" : "bg-teal-50 text-teal-700") : sos ? "text-rose-500 hover:bg-slate-50" : "text-slate-500 hover:bg-slate-50"}`}>
              <t.icon size={18} />
              {t.label}
            </button>
          );
        })}
      </div>

      {panel && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-4">
          {panel === "notes" && (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span>{n.worker_name ?? "You"}{n.restricted ? " · 🔒 managers only" : ""}</span>
                    <Badge tone={statusTone(n.status)}>{n.status}</Badge>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">{n.body}</p>
                </div>
              ))}
              <textarea className={inputCls} rows={3}
                placeholder="How did the shift go?"
                value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-500">
                  <input type="checkbox" checked={restricted}
                    onChange={(e) => setRestricted(e.target.checked)}
                    className="h-4 w-4 accent-teal-600" />
                  Managers only
                </label>
                <div className="flex gap-2">
                  <Btn kind="ghost" onClick={() => saveNote(false)}>Save draft</Btn>
                  <Btn onClick={() => saveNote(true)}>Submit</Btn>
                </div>
              </div>
            </div>
          )}
          {panel === "info" && <ParticipantBrief id={s.participant_id} />}
          {panel === "swap" && (
            <SwapPicker sid={s.id} onDone={() => { setPanel(null); onDone(); }} />
          )}
          {panel === "sos" && <EmergencyPanel pid={s.participant_id} />}
        </div>
      )}
    </div>
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
    }).catch((e) => alert(e.message));
    onDone();
  };

  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">Ask someone to cover this shift.</p>
      <select className={inputCls} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Anyone available</option>
        {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
      </select>
      <Btn className="mt-2 w-full" onClick={send}>Send request</Btn>
    </div>
  );
}

function EmergencyPanel({ pid }: { pid: number }) {
  const [reason, setReason] = useState("");
  const [info, setInfo] = useState<Record<string, string | null> | null>(null);
  const [err, setErr] = useState("");

  const go = async () => {
    setErr("");
    const r = await get<{ emergency: Record<string, string | null> }>(
      `/api/participants/${pid}/emergency?reason=${encodeURIComponent(reason)}`)
      .catch((e) => { setErr(e.message); return null; });
    if (r) setInfo(r.emergency);
  };

  if (info) {
    return (
      <dl className="space-y-2 text-sm">
        {Object.entries(info).filter(([, v]) => v).map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs font-medium capitalize text-rose-500">{k.replace(/_/g, " ")}</dt>
            <dd className="text-slate-800">{String(v)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return (
    <div>
      <p className="mb-2 text-sm text-slate-600">
        Emergency contacts, risks and medications. Opening this is logged.
      </p>
      <input className={inputCls} placeholder="What's happening? (e.g. participant has fallen)"
        value={reason} onChange={(e) => setReason(e.target.value)} />
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
      <Btn kind="danger" className="mt-2 w-full" disabled={reason.trim().length < 5} onClick={go}>
        Show emergency info
      </Btn>
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
    <div className="mb-4 rounded-3xl bg-amber-50 p-4 ring-1 ring-amber-200/70">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900">
        <Bell size={16} /> {offers.length} shift{offers.length > 1 ? "s" : ""} up for grabs
      </div>
      <div className="space-y-2">
        {offers.map((o) => (
          <div key={o.id} className="rounded-2xl bg-white p-3 text-sm shadow-sm">
            <div className="font-semibold text-slate-900">
              {o.shift ? `${fmtDay(o.shift.date)}, ${o.shift.start_time}–${o.shift.end_time}` : ""}
            </div>
            <div className="text-slate-600">{o.shift?.participant_name}</div>
            <div className="mt-0.5 text-xs text-slate-400">
              {o.kind === "swap"
                ? `${o.creator_name} needs cover`
                : o.target_worker_id ? `Offered by ${o.creator_name}` : `Open shift · ${o.creator_name}`}
              {o.shift?.location ? ` · ${o.shift.location}` : ""}
            </div>
            <div className="mt-3 flex gap-2">
              <Btn kind="success" className="flex-1" onClick={() => act(o, "accept")}>Take it</Btn>
              <Btn kind="ghost" className="flex-1" onClick={() => act(o, "decline")}>No thanks</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParticipantBrief({ id }: { id: number }) {
  const [p, setP] = useState<Participant | null>(null);
  useEffect(() => {
    get<{ participant: Participant }>(`/api/participants/${id}`)
      .then((r) => setP(r.participant)).catch(() => {});
  }, [id]);
  if (!p) return <p className="text-sm text-slate-400">Loading…</p>;
  const rows: [string, string | null | undefined][] = [
    ["Allergies", p.allergies],
    ["Risks", p.risks],
    ["Medications", p.medications],
    ["Mobility", p.mobility_info],
    ["Routines", p.routines],
    ["Emergency contact", p.emergency_contact],
  ];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return <p className="text-sm text-slate-400">No extra info on file.</p>;
  return (
    <dl className="space-y-2 text-sm">
      {shown.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium text-slate-400">{k}</dt>
          <dd className="text-slate-700">{v}</dd>
        </div>
      ))}
    </dl>
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
    <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
      <WifiOff size={16} /> {n} update{n > 1 ? "s" : ""} waiting for signal
    </div>
  );
}

export default function Today() {
  const { user } = useAuth();
  const isWorker = user?.role === "worker";
  const today = isoLocal(new Date());
  const [date, setDate] = useState(today);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = () =>
    get<{ shifts: Shift[] }>(`/api/shifts?start=${date}&end=${date}`)
      .then((r) => setShifts(r.shifts))
      .finally(() => setLoaded(true));

  useEffect(() => { load().catch(() => {}); }, [date]);

  const live = shifts.filter((s) => s.status !== "cancelled").length;
  const day = fmtDay(date);
  const first = user?.name.split(" ")[0];

  return (
    <Page narrow
      title={isWorker ? `${greeting()}, ${first}` : "Today's shifts"}
      subtitle={loaded
        ? `${live ? live : "No"} shift${live === 1 ? "" : "s"} ${day === "Today" || day === "Tomorrow" || day === "Yesterday" ? day.toLowerCase() : `on ${day}`}`
        : undefined}>
      <QueueChip />
      {isWorker && <OffersSection onDone={load} />}

      <div className={`mb-4 flex items-center justify-between rounded-2xl bg-white p-1.5 ${cardShadow}`}>
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
          <ChevronLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <label className="relative cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-slate-800 hover:bg-slate-50">
            {day}
            <input type="date" value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              onClick={(e) => (e.currentTarget as any).showPicker?.()}
              className="absolute inset-0 cursor-pointer opacity-0" />
          </label>
          {date !== today && (
            <button onClick={() => setDate(today)}
              className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
              Today
            </button>
          )}
        </div>
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Next day"
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="space-y-4">
        {shifts.map((s) => <ShiftCard key={s.id} s={s} onDone={load} />)}
        {loaded && !shifts.length && (
          <Card className="py-10 text-center">
            <div className="text-3xl">☀️</div>
            <p className="mt-2 font-medium text-slate-700">Nothing scheduled</p>
            <p className="text-sm text-slate-400">Enjoy the break.</p>
          </Card>
        )}
      </div>
    </Page>
  );
}
