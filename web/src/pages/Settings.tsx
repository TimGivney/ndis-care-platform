import { useEffect, useState } from "react";

import { useAuth } from "../App";
import { get, put } from "../lib/api";
import { Org, todayISO } from "../lib/types";
import { Btn, Card, Field, inputCls, Page } from "../lib/ui";

export default function Settings() {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "manager";
  const [org, setOrg] = useState<Org | null>(null);
  const [saved, setSaved] = useState("");
  const [quiet, setQuiet] = useState({ quiet_start: "", quiet_end: "" });
  const [range, setRange] = useState({ start: todayISO(), end: todayISO() });

  useEffect(() => {
    get<{ org: Org }>("/api/org").then((r) => setOrg(r.org)).catch(() => {});
    get<{ user: any }>("/api/auth/me").then((r) => {
      setQuiet({
        quiet_start: r.user.quiet_start ?? "",
        quiet_end: r.user.quiet_end ?? "",
      });
    }).catch(() => {});
  }, []);

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org) return;
    await put("/api/org", org).catch((err) => alert(err.message));
    setSaved("Saved");
    setTimeout(() => setSaved(""), 2000);
  };

  const saveQuiet = async () => {
    await put("/api/me/prefs", {
      quiet_start: quiet.quiet_start || null,
      quiet_end: quiet.quiet_end || null,
    }).catch((err) => alert(err.message));
    setSaved("Saved");
    setTimeout(() => setSaved(""), 2000);
  };

  const reports = [
    ["shifts", "Shifts & services"],
    ["timesheets", "Timesheets & hours"],
    ["incidents", "Incident register"],
    ["notes", "Progress notes"],
  ];

  return (
    <Page title="Settings">
      {saved && (
        <div className="mb-3 rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
          ✓ {saved}
        </div>
      )}

      {isManager && org && (
        <Card className="mb-4">
          <h2 className="mb-3 font-semibold">Organisation</h2>
          <form onSubmit={saveOrg} className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className={inputCls} value={org.name}
              onChange={(e) => setOrg({ ...org, name: e.target.value })} /></Field>
            <Field label="ABN"><input className={inputCls} value={org.abn ?? ""}
              onChange={(e) => setOrg({ ...org, abn: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={org.phone ?? ""}
              onChange={(e) => setOrg({ ...org, phone: e.target.value })} /></Field>
            <Field label="Email"><input className={inputCls} value={org.email ?? ""}
              onChange={(e) => setOrg({ ...org, email: e.target.value })} /></Field>
            <div className="sm:col-span-2">
              <Field label="Address"><input className={inputCls} value={org.address ?? ""}
                onChange={(e) => setOrg({ ...org, address: e.target.value })} /></Field>
            </div>
            <div className="sm:col-span-2"><Btn>Save org details</Btn></div>
          </form>
        </Card>
      )}

      <Card className="mb-4">
        <h2 className="mb-1 font-semibold">Quiet hours 🔕</h2>
        <p className="mb-3 text-sm text-slate-500">
          Notifications still arrive, but nothing pings you between these times.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">
            <input type="time" className={inputCls} value={quiet.quiet_start}
              onChange={(e) => setQuiet({ ...quiet, quiet_start: e.target.value })} />
          </Field>
          <Field label="To">
            <input type="time" className={inputCls} value={quiet.quiet_end}
              onChange={(e) => setQuiet({ ...quiet, quiet_end: e.target.value })} />
          </Field>
          <Btn onClick={saveQuiet}>Save</Btn>
          {(quiet.quiet_start || quiet.quiet_end) && (
            <Btn kind="ghost" onClick={() => {
              setQuiet({ quiet_start: "", quiet_end: "" });
              put("/api/me/prefs", { quiet_start: null, quiet_end: null });
            }}>Clear</Btn>
          )}
        </div>
      </Card>

      {isManager && (
        <Card>
          <h2 className="mb-1 font-semibold">Reports & exports 📊</h2>
          <p className="mb-3 text-sm text-slate-500">
            Download CSV files for payroll, invoicing, or compliance.
          </p>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <Field label="From"><input type="date" className={inputCls}
              value={range.start}
              onChange={(e) => setRange({ ...range, start: e.target.value })} /></Field>
            <Field label="To"><input type="date" className={inputCls}
              value={range.end}
              onChange={(e) => setRange({ ...range, end: e.target.value })} /></Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {reports.map(([key, label]) => (
              <a key={key}
                className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 hover:bg-teal-100"
                href={`/api/reports/${key}.csv?start=${range.start}&end=${range.end}`}
                download>
                ⬇ {label} (.csv)
              </a>
            ))}
          </div>
        </Card>
      )}
    </Page>
  );
}
