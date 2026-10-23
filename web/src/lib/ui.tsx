import { Heart } from "lucide-react";
import { ReactNode } from "react";

export function Page({ title, subtitle, children, actions, narrow }: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={`mx-auto px-4 pb-28 pt-6 sm:px-6 sm:pb-10 ${narrow ? "max-w-xl" : "max-w-6xl"}`}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-900">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

export const cardShadow =
  "shadow-[0_1px_2px_rgba(15,40,35,0.06),0_6px_20px_rgba(15,40,35,0.05)]";

export function Card({ children, className = "" }: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white p-4 ${cardShadow} ${className}`}>
      {children}
    </div>
  );
}

export function Field({ label, children }: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-[13px] font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm " +
  "placeholder:text-slate-400 focus:border-teal-500 focus:outline-none " +
  "focus:ring-2 focus:ring-teal-500/20";

export function Btn({ children, kind = "primary", ...rest }: {
  children: ReactNode;
  kind?: "primary" | "danger" | "ghost" | "success";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-teal-600 text-white shadow-sm hover:bg-teal-700",
    danger: "bg-rose-500 text-white shadow-sm hover:bg-rose-600",
    success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
    ghost: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  }[kind];
  return (
    <button
      {...rest}
      className={`rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40 ${styles} ${rest.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "slate" }: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-rose-50 text-rose-600",
    blue: "bg-teal-50 text-teal-700",
  }[tone];
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tones}`}>
      {children}
    </span>
  );
}

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      className="flex shrink-0 items-center justify-center bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm"
    >
      <Heart size={size * 0.52} fill="currentColor" strokeWidth={0} />
    </div>
  );
}

export function Avatar({ name, className = "" }: { name?: string | null; className?: string }) {
  const initials = (name ?? "?").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-semibold text-teal-800 ${className}`}>
      {initials}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Upcoming", confirmed: "Confirmed", checked_in: "In progress",
  in_progress: "In progress", completed: "Done", unfilled: "Unfilled",
  cancelled: "Cancelled", no_show: "No show",
};
export const statusLabel = (s: string) => STATUS_LABELS[s] ?? s.replace(/_/g, " ");

export function isoLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return isoLocal(d);
}

export function fmtDay(iso: string) {
  const t = isoLocal(new Date());
  if (iso === t) return "Today";
  if (iso === addDays(t, 1)) return "Tomorrow";
  if (iso === addDays(t, -1)) return "Yesterday";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
    weekday: "short", day: "numeric", month: "short",
  });
}

export function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function statusTone(s: string): "slate" | "green" | "amber" | "red" | "blue" {
  switch (s) {
    case "completed":
    case "reviewed":
    case "closed":
      return "green";
    case "checked_in":
    case "in_progress":
    case "submitted":
    case "confirmed":
      return "blue";
    case "unfilled":
    case "open":
    case "in_review":
    case "waiting":
      return "amber";
    case "cancelled":
    case "no_show":
    case "rejected":
      return "red";
    default:
      return "slate";
  }
}
