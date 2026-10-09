import { useEffect, useState } from "react";

import { get } from "../lib/api";
import { AuditEntry } from "../lib/types";
import { Card, Page } from "../lib/ui";

export default function Audit() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [entity, setEntity] = useState("");

  useEffect(() => {
    get<{ audit: AuditEntry[] }>(`/api/audit?limit=200${entity ? `&entity=${entity}` : ""}`)
      .then((r) => setRows(r.audit)).catch(() => {});
  }, [entity]);

  return (
    <Page title="Audit log">
      <select className="mb-3 rounded border border-slate-300 px-2 py-1.5 text-sm"
        value={entity} onChange={(e) => setEntity(e.target.value)}>
        <option value="">All record types</option>
        {["user", "participant", "worker", "shift", "shift_note", "incident",
          "client_request", "timesheet"].map((e) => (
            <option key={e} value={e}>{e.replace("_", " ")}</option>
          ))}
      </select>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2">Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Record</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className="border-b last:border-0">
                <td className="whitespace-nowrap py-1.5 text-slate-500">
                  {a.at ? new Date(a.at + "Z").toLocaleString("en-AU") : ""}
                </td>
                <td>{a.user_name}</td>
                <td>{a.action}</td>
                <td>{a.entity} #{a.entity_id}</td>
                <td className="text-slate-500">{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && <p className="py-4 text-center text-slate-500">No audit entries.</p>}
      </Card>
    </Page>
  );
}
