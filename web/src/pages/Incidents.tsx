import { useEffect, useState } from "react";

import { useAuth } from "../App";
import { get, post, put } from "../lib/api";
import { Incident, Participant } from "../lib/types";
import { Badge, Btn, Card, Field, inputCls, Page, statusTone } from "../lib/ui";

const EMPTY = {
  participant_id: "", occurred_at: new Date().toISOString().slice(0, 16),
  location: "", people_involved: "", category: "", severity: "medium",
  description: "", actions_taken: "", follow_up: "",
};

export default function Incidents() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [items, setItems] = useState<Incident[]>([]);
  const [parts, setParts] = useState<Participant[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const load = () =>
    get<{ incidents: Incident[] }>("/api/incidents").then((r) => setItems(r.incidents));

  useEffect(() => {
    load().catch(() => {});
    get<{ participants: Participant[] }>("/api/participants")
      .then((r) => setParts(r.participants)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await post("/api/incidents", {
        ...form, participant_id: +form.participant_id,
        occurred_at: new Date(form.occurred_at).toISOString(),
      });
      setCreating(false);
      setForm(EMPTY);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function setStatus(i: Incident, status: string) {
    await put(`/api/incidents/${i.id}`, { status });
    load();
  }

  return (
    <Page title="Incidents"
      actions={<Btn onClick={() => setCreating(!creating)}>+ Report incident</Btn>}>
      {creating && (
        <Card className="mb-4">
          <h2 className="mb-3 font-semibold">Report incident</h2>
          {error && <div className="mb-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <Field label="Participant *">
              <select className={inputCls} required value={form.participant_id}
                onChange={(e) => setForm({ ...form, participant_id: e.target.value })}>
                <option value="">Select…</option>
                {parts.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </Field>
            <Field label="When *">
              <input className={inputCls} type="datetime-local" required
                value={form.occurred_at}
                onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} />
            </Field>
            <Field label="Location">
              <input className={inputCls} value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </Field>
            <Field label="People involved">
              <input className={inputCls} value={form.people_involved}
                onChange={(e) => setForm({ ...form, people_involved: e.target.value })} />
            </Field>
            <Field label="Category">
              <input className={inputCls} value={form.category}
                placeholder="e.g. Medication, Injury, Behaviour"
                onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </Field>
            <Field label="Severity">
              <select className={inputCls} value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Description *">
                <textarea className={inputCls} rows={3} required
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Field>
            </div>
            <Field label="Actions taken">
              <textarea className={inputCls} rows={2} value={form.actions_taken}
                onChange={(e) => setForm({ ...form, actions_taken: e.target.value })} />
            </Field>
            <Field label="Follow-up required">
              <textarea className={inputCls} rows={2} value={form.follow_up}
                onChange={(e) => setForm({ ...form, follow_up: e.target.value })} />
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Btn>Submit report</Btn>
              <Btn kind="ghost" type="button" onClick={() => setCreating(false)}>Cancel</Btn>
            </div>
          </form>
        </Card>
      )}
      <div className="space-y-3">
        {items.map((i) => (
          <Card key={i.id}>
            <div className="mb-1 flex items-center justify-between">
              <div className="font-semibold">
                {i.participant_name}
                <span className="ml-2 text-sm font-normal text-slate-500">
                  {new Date(i.occurred_at).toLocaleString("en-AU")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={i.severity === "critical" || i.severity === "high" ? "red" : i.severity === "medium" ? "amber" : "slate"}>
                  {i.severity}
                </Badge>
                <Badge tone={statusTone(i.status)}>{i.status.replace("_", " ")}</Badge>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm">{i.description}</p>
            {i.actions_taken && (
              <p className="mt-1 text-sm text-slate-600"><b>Actions:</b> {i.actions_taken}</p>
            )}
            {i.follow_up && (
              <p className="mt-1 text-sm text-slate-600"><b>Follow-up:</b> {i.follow_up}</p>
            )}
            <div className="mt-2 text-xs text-slate-500">
              {i.category && <span className="mr-3">{i.category}</span>}
              {i.location && <span className="mr-3">📍 {i.location}</span>}
              {i.people_involved && <span>👥 {i.people_involved}</span>}
            </div>
            {isManager && i.status !== "closed" && (
              <div className="mt-3 flex gap-2">
                {i.status === "open" && (
                  <Btn kind="ghost" onClick={() => setStatus(i, "in_review")}>Start review</Btn>
                )}
                <Btn onClick={() => setStatus(i, "closed")}>Close incident</Btn>
              </div>
            )}
          </Card>
        ))}
        {!items.length && (
          <Card className="text-center text-slate-500">No incidents recorded.</Card>
        )}
      </div>
    </Page>
  );
}
