import { useEffect, useState } from "react";

import { useAuth } from "../App";
import { get, post } from "../lib/api";
import { Timesheet, todayISO } from "../lib/types";
import { Badge, Btn, Card, Page, statusTone } from "../lib/ui";

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

  return (
    <Page title="Timesheets">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <input type="date" className="rounded border border-slate-300 px-2 py-1"
          value={start} onChange={(e) => setStart(e.target.value)} />
        <span>–</span>
        <input type="date" className="rounded border border-slate-300 px-2 py-1"
          value={end} onChange={(e) => setEnd(e.target.value)} />
        <span className="ml-auto font-semibold">Total: {total.toFixed(2)}h</span>
      </div>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2">Date</th>
              <th>Scheduled</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th className="text-right">Hours</th>
              <th>Status</th>
              {isManager && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-b last:border-0">
                <td className="py-2">{t.date}</td>
                <td>{t.scheduled_start}–{t.scheduled_end}</td>
                <td>{t.check_in_at ? new Date(t.check_in_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td>{t.check_out_at ? new Date(t.check_out_at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td className="text-right font-medium">{t.hours ?? "—"}</td>
                <td><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                {isManager && (
                  <td className="text-right">
                    {t.status !== "approved" && (
                      <Btn kind="ghost" className="px-2 py-0.5 text-xs"
                        onClick={() => setStatus(t, "approved")}>Approve</Btn>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="py-4 text-center text-slate-500">
            No timesheets — they're created automatically when workers check in.
          </p>
        )}
      </Card>
    </Page>
  );
}
