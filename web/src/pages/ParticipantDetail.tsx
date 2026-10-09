import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";

import { del, get, put } from "../lib/api";
import { Participant } from "../lib/types";
import { Badge, Btn, Card, Field, inputCls, Page } from "../lib/ui";

const FIELDS: { key: keyof Participant; label: string; area?: boolean }[] = [
  { key: "full_name", label: "Full name" },
  { key: "preferred_name", label: "Preferred name" },
  { key: "date_of_birth", label: "Date of birth" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "address", label: "Address" },
  { key: "emergency_contact", label: "Emergency contact" },
  { key: "guardian", label: "Guardian / nominee" },
  { key: "ndis_number", label: "NDIS number" },
  { key: "plan_start", label: "Plan start" },
  { key: "plan_end", label: "Plan end" },
  { key: "support_coordinator", label: "Support coordinator" },
  { key: "plan_manager", label: "Plan manager" },
  { key: "support_needs", label: "Support needs", area: true },
  { key: "routines", label: "Important routines", area: true },
  { key: "mobility_info", label: "Mobility", area: true },
  { key: "communication_prefs", label: "Communication", area: true },
  { key: "risks", label: "Risks", area: true },
  { key: "allergies", label: "Allergies", area: true },
  { key: "medical_info", label: "Medical info", area: true },
  { key: "medications", label: "Medications", area: true },
  { key: "emergency_info", label: "Emergency info", area: true },
];

export default function ParticipantDetail() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<Participant | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [, navigate] = useLocation();

  useEffect(() => {
    get<{ participant: Participant }>(`/api/participants/${id}`).then((r) => {
      setP(r.participant);
      const f: Record<string, string> = {};
      for (const { key } of FIELDS) {
        f[key] = (r.participant[key] as string) ?? "";
      }
      setForm(f);
    });
  }, [id]);

  if (!p) return <Page title="Participant">Loading…</Page>;

  async function save() {
    const r = await put(`/api/participants/${id}`, form);
    setP(r.participant);
    setEditing(false);
  }

  return (
    <Page
      title={p.full_name}
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
            if (confirm(`Delete ${p.full_name}?`)) {
              await del(`/api/participants/${id}`);
              navigate("/participants");
            }
          }}>Delete</Btn>
        </div>
      }
    >
      <div className="mb-3 flex gap-2">
        {p.ndis_number && <Badge tone="blue">NDIS {p.ndis_number}</Badge>}
        {p.plan_end && <Badge>Plan to {p.plan_end}</Badge>}
        {!p.is_active && <Badge tone="red">Inactive</Badge>}
      </div>
      <Card>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map(({ key, label, area }) => (
            <Field key={key} label={label}>
              {editing ? (
                area ? (
                  <textarea
                    className={inputCls}
                    rows={2}
                    value={form[key] ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })}
                  />
                ) : (
                  <input
                    className={inputCls}
                    type={key.startsWith("date") || key.startsWith("plan_") ? "date" : "text"}
                    value={form[key] ?? ""}
                    onChange={(e) =>
                      setForm({ ...form, [key]: e.target.value })}
                  />
                )
              ) : (
                <div className="min-h-6 whitespace-pre-wrap py-1.5 text-sm">
                  {(p[key] as string) || <span className="text-slate-300">—</span>}
                </div>
              )}
            </Field>
          ))}
        </div>
      </Card>
    </Page>
  );
}
