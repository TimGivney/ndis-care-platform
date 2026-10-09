import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../App";
import { get, post, put } from "../lib/api";
import {
  mondayOf, Participant, Shift, todayISO, WEEKDAYS, Worker,
} from "../lib/types";
import { Badge, Btn, Card, Field, inputCls, Page, statusTone } from "../lib/ui";

interface Form {
  participant_id: string;
  worker_id: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  service_type: string;
  instructions: string;
}

const EMPTY: Form = {
  participant_id: "", worker_id: "", date: todayISO(),
  start_time: "09:00", end_time: "12:00", location: "",
  service_type: "", instructions: "",
};

export default function Roster() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [weekStart, setWeekStart] = useState(mondayOf(todayISO()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [parts, setParts] = useState<Participant[]>([]);
  const [fWorker, setFWorker] = useState("");
  const [editing, setEditing] = useState<Shift | null>(null);
  const [creating, setCreating] = useState(false);
  const [offering, setOffering] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");

  const end = useMemo(() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }, [weekStart]);

  const load = () =>
    get<{ shifts: Shift[] }>(
      `/api/shifts?start=${weekStart}&end=${end}${fWorker ? `&worker_id=${fWorker}` : ""}`)
      .then((r) => setShifts(r.shifts));

  useEffect(() => { load().catch(() => {}); }, [weekStart, end, fWorker]);
  useEffect(() => {
    if (isManager) {
      get<{ workers: Worker[] }>("/api/workers").then((r) => setWorkers(r.workers));
      get<{ participants: Participant[] }>("/api/participants")
        .then((r) => setParts(r.participants));
    }
  }, [isManager]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  function week(delta: number) {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d.toISOString().slice(0, 10));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        ...form,
        participant_id: +form.participant_id,
        worker_id: form.worker_id ? +form.worker_id : null,
        location: form.location || null,
        service_type: form.service_type || null,
        instructions: form.instructions || null,
      };
      const r = editing
        ? await put(`/api/shifts/${editing.id}`, payload)
        : await post("/api/shifts", payload);
      setWarning(r.warning ?? "");
      setCreating(false);
      setEditing(null);
      setForm(EMPTY);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function cancel(s: Shift) {
    const reason = prompt("Cancellation reason?") ?? "";
    await post(`/api/shifts/${s.id}/cancel`, { reason });
    load();
  }

  async function sendOffer(s: Shift, workerId: string) {
    await post(`/api/shifts/${s.id}/offers`, {
      target_worker_id: workerId ? +workerId : null,
    }).catch((e) => alert(e.message));
    setOffering(null);
  }

  function openEdit(s: Shift) {
    setEditing(s);
    setCreating(true);
    setForm({
      participant_id: String(s.participant_id),
      worker_id: s.worker_id ? String(s.worker_id) : "",
      date: s.date, start_time: s.start_time, end_time: s.end_time,
      location: s.location ?? "", service_type: s.service_type ?? "",
      instructions: s.instructions ?? "",
    });
  }

  const byDay = (d: string) => shifts.filter((s) => s.date === d);

  return (
    <Page title="Roster" actions={
      isManager ? <Btn onClick={() => { setCreating(true); setEditing(null); setForm(EMPTY); }}>+ New shift</Btn> : undefined
    }>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Btn kind="ghost" onClick={() => week(-1)}>← Prev</Btn>
        <Btn kind="ghost" onClick={() => setWeekStart(mondayOf(todayISO()))}>This week</Btn>
        <Btn kind="ghost" onClick={() => week(1)}>Next →</Btn>
        <span className="text-sm text-slate-600">
          {new Date(weekStart + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
          {" – "}
          {new Date(end + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
        </span>
        {isManager && (
          <select className={inputCls + " ml-auto w-48"} value={fWorker}
            onChange={(e) => setFWorker(e.target.value)}>
            <option value="">All workers</option>
            {workers.map((w) => (
              <option key={w.id} value={w.id}>{w.full_name}</option>
            ))}
          </select>
        )}
      </div>

      {warning && (
        <div className="mb-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠ {warning}
          <button className="ml-2 underline" onClick={() => setWarning("")}>dismiss</button>
        </div>
      )}

      {creating && isManager && (
        <Card className="mb-4">
          <h2 className="mb-3 font-semibold">{editing ? "Edit shift" : "New shift"}</h2>
          {error && <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
            <Field label="Participant *">
              <select className={inputCls} required value={form.participant_id}
                onChange={(e) => setForm({ ...form, participant_id: e.target.value })}>
                <option value="">Select…</option>
                {parts.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>
            <Field label="Worker">
              <select className={inputCls} value={form.worker_id}
                onChange={(e) => setForm({ ...form, worker_id: e.target.value })}>
                <option value="">— unfilled —</option>
                {workers.map((w) => <option key={w.id} value={w.id}>{w.full_name}</option>)}
              </select>
            </Field>
            <Field label="Date *">
              <input className={inputCls} type="date" required value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Start *">
              <input className={inputCls} type="time" required value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
            </Field>
            <Field label="End *">
              <input className={inputCls} type="time" required value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </Field>
            <Field label="Service type">
              <input className={inputCls} value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value })} />
            </Field>
            <Field label="Location">
              <input className={inputCls} value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Instructions">
                <input className={inputCls} value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
              </Field>
            </div>
            <div className="flex items-end gap-2 sm:col-span-3">
              <Btn>{editing ? "Save changes" : "Create shift"}</Btn>
              <Btn kind="ghost" type="button"
                onClick={() => { setCreating(false); setEditing(null); }}>Cancel</Btn>
            </div>
          </form>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-7">
        {days.map((d, i) => (
          <div key={d} className="min-h-24">
            <div className={`mb-1 text-center text-xs font-semibold uppercase tracking-wide ${d === todayISO() ? "text-blue-700" : "text-slate-500"}`}>
              {WEEKDAYS[i]} {new Date(d + "T00:00:00").getDate()}
            </div>
            <div className="space-y-2">
              {byDay(d).map((s) => (
                <div key={s.id}
                  className={`rounded-lg border bg-white p-2 text-xs shadow-sm ${s.status === "cancelled" ? "opacity-50" : ""} ${s.status === "unfilled" ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
                  <div className="font-semibold">{s.start_time}–{s.end_time}</div>
                  <div>{s.participant_name}</div>
                  <div className="text-slate-500">
                    {s.worker_name ?? <span className="font-medium text-red-600">unfilled</span>}
                  </div>
                  {s.service_type && <div className="text-slate-400">{s.service_type}</div>}
                  <div className="mt-1 flex items-center justify-between">
                    <Badge tone={statusTone(s.status)}>{s.status.replace("_", " ")}</Badge>
                    {isManager && s.status !== "cancelled" && s.status !== "completed" && (
                      <span className="space-x-1">
                        <button className="text-teal-700 hover:underline"
                          onClick={() => setOffering(offering === s.id ? null : s.id)}>
                          offer
                        </button>
                        <button className="text-teal-700 hover:underline" onClick={() => openEdit(s)}>edit</button>
                        <button className="text-rose-500 hover:underline" onClick={() => cancel(s)}>✕</button>
                      </span>
                    )}
                  </div>
                  {offering === s.id && (
                    <div className="mt-1 rounded-lg bg-teal-50 p-1.5">
                      <select className="w-full rounded border border-teal-200 bg-white px-1 py-1"
                        defaultValue="pick" autoFocus
                        onChange={(e) => sendOffer(s, e.target.value)}>
                        <option value="pick" disabled>Offer to…</option>
                        <option value="">📢 All workers</option>
                        {workers.filter((w) => w.id !== s.worker_id).map((w) => (
                          <option key={w.id} value={w.id}>{w.full_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
              {!byDay(d).length && (
                <div className="rounded border border-dashed border-slate-200 p-2 text-center text-xs text-slate-300">
                  —
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
