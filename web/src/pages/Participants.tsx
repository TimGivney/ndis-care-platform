import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import { get, post } from "../lib/api";
import { Participant } from "../lib/types";
import { Btn, Card, Field, inputCls, Page } from "../lib/ui";

export default function Participants() {
  const [items, setItems] = useState<Participant[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [ndis, setNdis] = useState("");
  const [, navigate] = useLocation();

  const load = () =>
    get<{ participants: Participant[] }>("/api/participants")
      .then((r) => setItems(r.participants));

  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    const r = await post("/api/participants", {
      full_name: name, phone: phone || null, ndis_number: ndis || null,
    });
    navigate(`/participants/${r.participant.id}`);
  }

  return (
    <Page title="Participants"
      actions={<Btn onClick={() => setShowNew(!showNew)}>+ New participant</Btn>}>
      {showNew && (
        <Card className="mb-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Full name *">
              <input className={inputCls} value={name}
                onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Phone">
              <input className={inputCls} value={phone}
                onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="NDIS number">
              <input className={inputCls} value={ndis}
                onChange={(e) => setNdis(e.target.value)} />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Btn onClick={create}>Create</Btn>
            <Btn kind="ghost" onClick={() => setShowNew(false)}>Cancel</Btn>
          </div>
        </Card>
      )}
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2">Name</th>
              <th>Phone</th>
              <th>NDIS #</th>
              <th>Plan ends</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="py-2 font-medium">
                  <Link href={`/participants/${p.id}`} className="text-blue-700 hover:underline">
                    {p.full_name}
                  </Link>
                  {p.preferred_name && (
                    <span className="ml-1 text-slate-400">"{p.preferred_name}"</span>
                  )}
                </td>
                <td>{p.phone}</td>
                <td>{p.ndis_number}</td>
                <td>{p.plan_end}</td>
                <td className="text-right">
                  {!p.is_active && <span className="text-xs text-red-600">inactive</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="py-4 text-center text-slate-500">No participants yet.</p>}
      </Card>
    </Page>
  );
}
