import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";

import { get, post } from "../lib/api";
import { Worker } from "../lib/types";
import { Btn, Card, Field, inputCls, Page } from "../lib/ui";

export default function Workers() {
  const [items, setItems] = useState<Worker[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [position, setPosition] = useState("Support Worker");
  const [, navigate] = useLocation();

  useEffect(() => {
    get<{ workers: Worker[] }>("/api/workers").then((r) => setItems(r.workers));
  }, []);

  async function create() {
    if (!name.trim()) return;
    const r = await post("/api/workers", {
      full_name: name, phone: phone || null, position,
      availability: [], qualifications: [],
    });
    navigate(`/workers/${r.worker.id}`);
  }

  return (
    <Page title="Workers"
      actions={<Btn onClick={() => setShowNew(!showNew)}>+ New worker</Btn>}>
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
            <Field label="Position">
              <input className={inputCls} value={position}
                onChange={(e) => setPosition(e.target.value)} />
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
              <th>Position</th>
              <th>Phone</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="py-2 font-medium">
                  <Link href={`/workers/${w.id}`} className="text-blue-700 hover:underline">
                    {w.full_name}
                  </Link>
                </td>
                <td>{w.position}</td>
                <td>{w.phone}</td>
                <td className="text-right">
                  {!w.is_active && <span className="text-xs text-red-600">inactive</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && <p className="py-4 text-center text-slate-500">No workers yet.</p>}
      </Card>
    </Page>
  );
}
