import { ReactNode } from "react";

export function Page({ title, children, actions }: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">{title}</h1>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-teal-100 bg-white p-4 shadow-sm ${className}`}>
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
      <span className="mb-1 block font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-teal-500 focus:outline-none";

export function Btn({ children, kind = "primary", ...rest }: {
  children: ReactNode;
  kind?: "primary" | "danger" | "ghost" | "success";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const styles = {
    primary: "bg-teal-600 text-white hover:bg-teal-700",
    danger: "bg-rose-500 text-white hover:bg-rose-600",
    success: "bg-emerald-600 text-white hover:bg-emerald-700",
    ghost: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  }[kind];
  return (
    <button
      {...rest}
      className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${styles} ${rest.className ?? ""}`}
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
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-teal-100 text-teal-800",
  }[tone];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones}`}>
      {children}
    </span>
  );
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
