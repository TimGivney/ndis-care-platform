import { useEffect, useState } from "react";
import { Link } from "wouter";

import { useAuth } from "../App";
import { get } from "../lib/api";
import { Dashboard as Dash } from "../lib/types";
import { Card, Page } from "../lib/ui";

function Stat({ label, count, tone, href }: {
  label: string;
  count: number;
  tone: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className={`cursor-pointer border-l-4 hover:shadow ${tone}`}>
        <div className="text-2xl font-bold">{count}</div>
        <div className="text-sm text-slate-600">{label}</div>
      </Card>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [d, setD] = useState<Dash | null>(null);
  const isManager = user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    get<Dash>("/api/dashboard").then(setD).catch(() => {});
  }, []);

  if (!d) return <Page title="Dashboard">Loading…</Page>;

  const problems = d.unfilled.length + d.missed_checkins.length;

  return (
    <Page title={`Today — ${new Date().toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" })}`}>
      {isManager && problems > 0 && (
        <Card className="mb-4 border-l-4 border-l-red-500">
          <h2 className="mb-2 font-semibold text-red-700">
            {problems} problem{problems > 1 ? "s" : ""} today
          </h2>
          <ul className="space-y-1 text-sm">
            {d.missed_checkins.map((s) => (
              <li key={`m${s.id}`}>
                🔴 {s.worker_name} hasn't checked in — {s.participant_name} at {s.start_time}
              </li>
            ))}
            {d.unfilled.map((s) => (
              <li key={`u${s.id}`}>
                🔴 {s.start_time} shift for {s.participant_name} is unfilled
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Shifts today" count={d.todays_shifts}
          tone="border-l-blue-500" href="/roster" />
        {isManager && (
          <>
            <Stat label="Unfilled today" count={d.unfilled.length}
              tone="border-l-red-500" href="/roster" />
            <Stat label="Not checked in" count={d.missed_checkins.length}
              tone="border-l-amber-500" href="/roster" />
            <Stat label="Notes to review" count={d.notes_pending_review ?? 0}
              tone="border-l-blue-500" href="/notes" />
            <Stat label="Open incidents" count={d.open_incidents ?? 0}
              tone="border-l-amber-500" href="/incidents" />
            <Stat label="Open requests" count={d.open_requests ?? 0}
              tone="border-l-blue-500" href="/requests" />
            <Stat label="Certs expiring ≤30d" count={d.expiring_certs?.length ?? 0}
              tone="border-l-amber-500" href="/workers" />
          </>
        )}
      </div>

      {isManager && !!d.expiring_certs?.length && (
        <Card className="mt-4">
          <h2 className="mb-2 font-semibold">Certificates expiring soon</h2>
          <table className="w-full text-sm">
            <tbody>
              {d.expiring_certs.map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-1.5">{c.worker_name}</td>
                  <td>{c.name}</td>
                  <td className="text-right text-amber-700">{c.expires_on}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Page>
  );
}
