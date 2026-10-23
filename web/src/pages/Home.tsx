import { useEffect, useState } from "react";
import { ChevronRight, Inbox, MessageCircle } from "lucide-react";
import { Link } from "wouter";

import { useAuth } from "../App";
import { get } from "../lib/api";
import { Shift } from "../lib/types";
import {
  addDays, Avatar, Card, cardShadow, fmtDay, greeting, isoLocal, Page,
} from "../lib/ui";

export default function Home() {
  const { user } = useAuth();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const start = isoLocal(new Date());
    get<{ shifts: Shift[] }>(`/api/shifts?start=${start}&end=${addDays(start, 14)}`)
      .then((r) => setShifts(r.shifts.filter(
        (s) => !["cancelled", "completed", "no_show"].includes(s.status))))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const next = shifts[0];
  const upcoming = shifts.slice(1, 8);
  const now = next && ["checked_in", "in_progress"].includes(next.status);

  return (
    <Page narrow title={`${greeting()}, ${user?.name.split(" ")[0]}`}
      subtitle="Here's what's coming up">
      {next ? (
        <div className="rounded-3xl bg-gradient-to-br from-teal-600 to-emerald-600 p-5 text-white shadow-lg shadow-teal-900/10">
          <div className="text-xs font-semibold uppercase tracking-wider text-teal-100">
            {now ? "Happening now" : "Your next support"}
          </div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">
            {fmtDay(next.date)}, {next.start_time}
          </div>
          <div className="text-sm text-teal-50">
            {next.service_type ?? "Support"} · until {next.end_time}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/15 p-3">
            <Avatar name={next.worker_name ?? "?"} className="bg-white text-teal-700" />
            <div>
              <div className="text-sm font-semibold">
                {next.worker_name ?? "Worker to be confirmed"}
              </div>
              <div className="text-xs text-teal-100">
                {next.worker_name
                  ? now ? "Is with you now" : "Your support worker"
                  : "We'll let you know who's coming"}
              </div>
            </div>
          </div>
        </div>
      ) : loaded && (
        <Card className="py-8 text-center">
          <p className="font-medium text-slate-700">No supports booked in the next 2 weeks</p>
          <p className="text-sm text-slate-400">Ask your team if you'd like some.</p>
        </Card>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link href="/requests"
          className={`rounded-2xl bg-white p-4 transition hover:-translate-y-0.5 ${cardShadow}`}>
          <Inbox size={22} className="mb-2 text-teal-600" />
          <div className="text-sm font-semibold text-slate-900">Ask for a change</div>
          <div className="text-xs text-slate-500">Times, worker, extra help</div>
        </Link>
        <Link href="/messages"
          className={`rounded-2xl bg-white p-4 transition hover:-translate-y-0.5 ${cardShadow}`}>
          <MessageCircle size={22} className="mb-2 text-teal-600" />
          <div className="text-sm font-semibold text-slate-900">Message my team</div>
          <div className="text-xs text-slate-500">Chat with your workers</div>
        </Link>
      </div>

      {upcoming.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 text-sm font-semibold text-slate-500">Coming up</h2>
          <div className={`divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white ${cardShadow}`}>
            {upcoming.map((s) => {
              const d = new Date(s.date + "T00:00:00");
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-xl bg-teal-50 py-1 text-teal-800">
                    <span className="text-[10px] font-semibold uppercase">
                      {d.toLocaleDateString("en-AU", { weekday: "short" })}
                    </span>
                    <span className="text-base font-semibold leading-tight">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {s.start_time} – {s.end_time}
                    </div>
                    <div className="truncate text-xs text-slate-500">
                      {s.service_type ?? "Support"} · {s.worker_name ?? "worker TBC"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <Link href="/roster"
            className="mt-3 flex items-center justify-center gap-1 text-sm font-medium text-teal-700">
            See full schedule <ChevronRight size={16} />
          </Link>
        </>
      )}
    </Page>
  );
}
