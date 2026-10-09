import { useEffect, useState } from "react";

import { useAuth } from "../App";
import { get, post, put } from "../lib/api";
import { ClientRequest } from "../lib/types";
import { Badge, Btn, Card, Field, inputCls, Page, statusTone } from "../lib/ui";

const KINDS = ["general", "schedule_change", "worker_change", "transport", "feedback", "other"];
const STATUSES = ["submitted", "assigned", "in_progress", "waiting", "completed", "rejected"];

export default function Requests() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [items, setItems] = useState<ClientRequest[]>([]);
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("general");
  const [editingResp, setEditingResp] = useState<Record<number, string>>({});

  const load = () =>
    get<{ requests: ClientRequest[] }>("/api/requests").then((r) => setItems(r.requests));

  useEffect(() => { load().catch(() => {}); }, []);

  async function submit() {
    if (!body.trim()) return;
    await post("/api/requests", { kind, body });
    setBody("");
    load();
  }

  async function update(id: number, patch: Record<string, unknown>) {
    await put(`/api/requests/${id}`, patch);
    load();
  }

  return (
    <Page title="Requests">
      <Card className="mb-4">
        <h2 className="mb-2 font-semibold">New request</h2>
        <div className="flex flex-wrap gap-2">
          <select className={inputCls + " w-44"} value={kind}
            onChange={(e) => setKind(e.target.value)}>
            {KINDS.map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
          </select>
          <input className={inputCls + " flex-1"} placeholder="What do you need?"
            value={body} onChange={(e) => setBody(e.target.value)} />
          <Btn onClick={submit}>Submit</Btn>
        </div>
        {!isManager && (
          <p className="mt-1 text-xs text-slate-500">
            Your request goes to your provider's managers — they'll see it on their dashboard.
          </p>
        )}
      </Card>
      <div className="space-y-3">
        {items.map((r) => (
          <Card key={r.id}>
            <div className="mb-1 flex items-center justify-between">
              <div className="font-semibold">
                {r.participant_name}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {r.kind.replace("_", " ")} · {r.created_at ? new Date(r.created_at).toLocaleString("en-AU") : ""}
                </span>
              </div>
              <Badge tone={statusTone(r.status)}>{r.status.replace("_", " ")}</Badge>
            </div>
            <p className="text-sm">{r.body}</p>
            {r.response && (
              <p className="mt-2 rounded bg-blue-50 px-3 py-2 text-sm">
                <b>Response:</b> {r.response}
              </p>
            )}
            {isManager && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select className={inputCls + " w-36"} value={r.status}
                  onChange={(e) => update(r.id, { status: e.target.value })}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
                <input className={inputCls + " flex-1"} placeholder="Write a response…"
                  value={editingResp[r.id] ?? ""}
                  onChange={(e) => setEditingResp({ ...editingResp, [r.id]: e.target.value })} />
                <Btn kind="ghost" onClick={() =>
                  update(r.id, { response: editingResp[r.id] ?? "" })
                }>Reply</Btn>
              </div>
            )}
          </Card>
        ))}
        {!items.length && (
          <Card className="text-center text-slate-500">No requests yet.</Card>
        )}
      </div>
    </Page>
  );
}
