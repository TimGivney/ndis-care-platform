import { useEffect, useState } from "react";

import { useAuth } from "../App";
import { get, post } from "../lib/api";
import { ShiftNote } from "../lib/types";
import { Badge, Btn, Card, Page, statusTone } from "../lib/ui";

export default function Notes() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [notes, setNotes] = useState<ShiftNote[]>([]);
  const [filter, setFilter] = useState("submitted");

  const load = () =>
    get<{ notes: ShiftNote[] }>(`/api/notes${filter ? `?status=${filter}` : ""}`)
      .then((r) => setNotes(r.notes));

  useEffect(() => { load().catch(() => {}); }, [filter]);

  return (
    <Page title="Progress notes">
      <div className="mb-3 flex gap-2">
        {["", "draft", "submitted", "reviewed"].map((s) => (
          <button key={s || "all"}
            className={`rounded-full px-3 py-1 text-sm ${filter === s ? "bg-blue-700 text-white" : "bg-white text-slate-600"}`}
            onClick={() => setFilter(s)}>
            {s || "All"}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {notes.map((n) => (
          <Card key={n.id}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <div>
                <b>{n.participant_name}</b>
                <span className="text-slate-400"> · {n.worker_name} · shift #{n.shift_id}</span>
              </div>
              <div className="flex items-center gap-2">
                {n.restricted && <Badge tone="red">restricted</Badge>}
                <Badge tone={statusTone(n.status)}>{n.status}</Badge>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>v{n.version} · {n.submitted_at ? `submitted ${new Date(n.submitted_at).toLocaleString("en-AU")}` : "draft"}</span>
              {isManager && n.status === "submitted" && (
                <Btn onClick={async () => {
                  await post(`/api/notes/${n.id}/review`);
                  load();
                }}>Mark reviewed</Btn>
              )}
            </div>
          </Card>
        ))}
        {!notes.length && (
          <Card className="text-center text-slate-500">No notes.</Card>
        )}
      </div>
    </Page>
  );
}
