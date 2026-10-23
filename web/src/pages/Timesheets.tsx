import { useEffect, useState } from "react";

import { useAuth } from "../App";
import { get, post } from "../lib/api";
import { Timesheet, todayISO } from "../lib/types";
import { Badge, Btn, Card, fmtDay, inputCls, Page, statusTone } from "../lib/ui";

export default function Timesheets() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [rows, setRows] = useState<Timesheet[]>([]);
  const [start, setStart] = useState(todayISO(-14));
  const [end, setEnd] = useState(todayISO());

  const load = () =>
    get<{ timesheets: Timesheet[] }>(`/api/timesheets?start=${start}&end=${end}`)
      .then((r) => setRows(r.timesheets));

  useEffect(() => { load().catch(() => {}); }, [start, end]);

  async function setStatus(t: Timesheet, status: string) {
    await post(`/api/timesheets/${t.id}/status?status=${status}`);
    load();
  }

  const total = rows.reduce((s, r) => s + (r.hours ?? 0), 0);

  const time = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <Page title={isManager ? "Timesheets" : "My hours"}
      subtitle={`${total.toFixed(2)} hours in this period`}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <input type="date" className={inputCls + " w-auto flex-1"}
          value={start} onChange={(e) => setStart(e.target.value)} />
        <span className="text-slate-400">to</span>
        <input type="date" className={inputCls + " w-auto flex-1"}
          value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <Card className="p-0">
        <div className="divide-y divide-slate-100">
          {rows.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">
                  {fmtDay(t.date)}
                </div>
                <div className="text-xs text-slate-500">
                  Rostered {t.scheduled_start}–{t.scheduled_end} · Actual {time(t.check_in_at)}–{time(t.check_out_at)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-slate-900">{t.hours != null ? `${t.hours}h` : "—"}</div>
                <Badge tone={statusTone(t.status)}>{t.status}</Badge>
              </div>
              {isManager && t.status !== "approved" && (
                <Btn kind="ghost" className="px-3 py-1 text-xs"
                  onClick={() => setStatus(t, "approved")}>Approve</Btn>
              )}
            </div>
          ))}
        </div>
        {!rows.length && (
          <p className="px-4 py-8 text-center text-sm text-slate-400">
            No hours yet — they're recorded automatically when you check in and out.
          </p>
        )}
      </Card>
    </Page>
  );
}
