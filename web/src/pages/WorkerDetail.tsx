import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

import { del, get, put } from "../lib/api";
import DocumentsCard from "../lib/DocumentsCard";
import { Availability, Qualification, WEEKDAYS, Worker } from "../lib/types";
import { Btn, Card, Field, inputCls, Page } from "../lib/ui";

export default function WorkerDetail() {
  const { id } = useParams<{ id: string }>();
  const [w, setW] = useState<Worker | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [avail, setAvail] = useState<Availability[]>([]);
  const [quals, setQuals] = useState<Qualification[]>([]);
  const [, navigate] = useLocation();

  const PLAIN: { key: string; label: string; type?: string }[] = [
    { key: "full_name", label: "Full name" },
    { key: "preferred_name", label: "Preferred name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "emergency_contact", label: "Emergency contact" },
    { key: "position", label: "Position" },
    { key: "employment_status", label: "Employment status" },
    { key: "start_date", label: "Start date", type: "date" },
    { key: "skills", label: "Skills" },
    { key: "notes", label: "Notes" },
  ];

  useEffect(() => {
    get<{ worker: Worker }>(`/api/workers/${id}`).then((r) => {
      setW(r.worker);
      const f: Record<string, string> = {};
      for (const { key } of PLAIN) f[key] = (r.worker as any)[key] ?? "";
      setForm(f);
      setAvail(r.worker.availability ?? []);
      setQuals(r.worker.qualifications ?? []);
    });
  }, [id]);

  if (!w) return <Page title="Worker">Loading…</Page>;

  async function save() {
    const r = await put(`/api/workers/${id}`, {
      ...form, availability: avail, qualifications: quals,
    });
    setW(r.worker);
    setEditing(false);
  }

  const setA = (i: number, k: keyof Availability, v: string | number) =>
    setAvail(avail.map((a, j) => (j === i ? { ...a, [k]: v } : a)));
  const setQ = (i: number, k: keyof Qualification, v: string) =>
    setQuals(quals.map((q, j) => (j === i ? { ...q, [k]: v } : q)));

  return (
    <Page title={w.full_name}
      actions={
        <div className="flex gap-2">
          {!editing && <Btn onClick={() => setEditing(true)}>Edit</Btn>}
          {editing && (
            <>
              <Btn onClick={save}>Save</Btn>
              <Btn kind="ghost" onClick={() => setEditing(false)}>Cancel</Btn>
            </>
          )}
          <Btn kind="danger" onClick={async () => {
            if (confirm(`Delete ${w.full_name}?`)) {
              await del(`/api/workers/${id}`);
              navigate("/workers");
            }
          }}>Delete</Btn>
        </div>
      }>
      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">Details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {PLAIN.map(({ key, label, type }) => (
            <Field key={key} label={label}>
              {editing ? (
                <input className={inputCls} type={type ?? "text"}
                  value={form[key] ?? ""}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              ) : (
                <div className="min-h-6 whitespace-pre-wrap py-1.5 text-sm">
                  {(w as any)[key] || <span className="text-slate-300">—</span>}
                </div>
              )}
            </Field>
          ))}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Weekly availability</h2>
          {editing && (
            <Btn kind="ghost" onClick={() =>
              setAvail([...avail, { weekday: 0, start_time: "09:00", end_time: "17:00", kind: "available" }])
            }>+ Add</Btn>
          )}
        </div>
        {!avail.length && <p className="text-sm text-slate-500">No availability recorded — roster won't warn.</p>}
        <div className="space-y-2">
          {avail.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              {editing ? (
                <>
                  <select className={inputCls + " w-24"} value={a.weekday}
                    onChange={(e) => setA(i, "weekday", +e.target.value)}>
                    {WEEKDAYS.map((d, j) => <option key={d} value={j}>{d}</option>)}
                  </select>
                  <input className={inputCls + " w-20"} value={a.start_time}
                    onChange={(e) => setA(i, "start_time", e.target.value)} />
                  <input className={inputCls + " w-20"} value={a.end_time}
                    onChange={(e) => setA(i, "end_time", e.target.value)} />
                  <select className={inputCls + " w-32"} value={a.kind}
                    onChange={(e) => setA(i, "kind", e.target.value)}>
                    <option value="available">available</option>
                    <option value="preferred">preferred</option>
                    <option value="unavailable">unavailable</option>
                    <option value="leave">leave</option>
                  </select>
                  <Btn kind="danger" onClick={() =>
                    setAvail(avail.filter((_, j) => j !== i))}>✕</Btn>
                </>
              ) : (
                <span>
                  <b>{WEEKDAYS[a.weekday]}</b> {a.start_time}–{a.end_time}
                  <span className="ml-1 text-slate-500">({a.kind})</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Qualifications & checks</h2>
          {editing && (
            <Btn kind="ghost" onClick={() =>
              setQuals([...quals, { name: "", issued_on: null, expires_on: null }])
            }>+ Add</Btn>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-1.5">Name</th>
              <th>Issued</th>
              <th>Expires</th>
              {editing && <th></th>}
            </tr>
          </thead>
          <tbody>
            {quals.map((q, i) => (
              <tr key={i} className="border-b last:border-0">
                {editing ? (
                  <>
                    <td><input className={inputCls} value={q.name}
                      onChange={(e) => setQ(i, "name", e.target.value)} /></td>
                    <td><input className={inputCls} type="date" value={q.issued_on ?? ""}
                      onChange={(e) => setQ(i, "issued_on", e.target.value || null as any)} /></td>
                    <td><input className={inputCls} type="date" value={q.expires_on ?? ""}
                      onChange={(e) => setQ(i, "expires_on", e.target.value || null as any)} /></td>
                    <td><Btn kind="danger" onClick={() =>
                      setQuals(quals.filter((_, j) => j !== i))}>✕</Btn></td>
                  </>
                ) : (
                  <>
                    <td className="py-1.5">{q.name}</td>
                    <td>{q.issued_on}</td>
                    <td className={q.expires_on && q.expires_on < new Date().toISOString().slice(0, 10) ? "text-red-600 font-medium" : ""}>
                      {q.expires_on}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!quals.length && <p className="py-2 text-sm text-slate-500">No qualifications recorded.</p>}
      </Card>

      <div className="mt-4">
        <DocumentsCard ownerType="worker" ownerId={w.id} canManage />
      </div>
    </Page>
  );
}
