import { FormEvent, useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

import { useAuth } from "../App";
import { post } from "../lib/api";
import { Avatar, BrandMark, Btn, cardShadow, Field, inputCls } from "../lib/ui";

const DEMO_ACCOUNTS = [
  ["manager@demo.care", "Mike Manager", "Manager · rosters & oversight"],
  ["sarah@demo.care", "Sarah Chen", "Support worker"],
  ["dave@demo.care", "Dave Kumar", "Support worker"],
  ["john@demo.care", "John Smith", "Participant · client view"],
];

export default function Login() {
  const { setUser } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(e: string, p: string) {
    setBusy(true);
    setError("");
    try {
      const r = await post("/api/auth/login", { email: e, password: p });
      setUser(r.user);
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  const submit = (ev: FormEvent) => { ev.preventDefault(); login(email, password); };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <BrandMark size={52} />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            Welcome to CareRoster
          </h1>
          <p className="mt-1 text-sm text-slate-500">Care and rostering for NDIS teams</p>
        </div>

        <form onSubmit={submit} className={`space-y-3 rounded-3xl bg-white p-6 ${cardShadow}`}>
          {error && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
          <Field label="Email">
            <input className={inputCls} type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </Field>
          <Field label="Password">
            <input className={inputCls} type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </Field>
          <Btn className="w-full py-3" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Btn>
        </form>

        <div className={`mt-4 rounded-3xl bg-white p-2 ${cardShadow}`}>
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-slate-400">
            Try a demo account
          </p>
          {DEMO_ACCOUNTS.map(([e, name, role]) => (
            <button key={e} type="button" disabled={busy}
              onClick={() => login(e, "demo1234")}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left hover:bg-slate-50">
              <Avatar name={name} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{name}</div>
                <div className="text-xs text-slate-500">{role}</div>
              </div>
              <ChevronRight size={18} className="text-slate-300" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
