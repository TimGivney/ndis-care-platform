import { FormEvent, useState } from "react";
import { useLocation } from "wouter";

import { useAuth } from "../App";
import { post } from "../lib/api";
import { Btn, Field, inputCls } from "../lib/ui";

const DEMO_ACCOUNTS = [
  ["manager@demo.care", "Manager"],
  ["sarah@demo.care", "Worker (Sarah)"],
  ["dave@demo.care", "Worker (Dave)"],
  ["john@demo.care", "Participant (John)"],
];

export default function Login() {
  const { setUser } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState("manager@demo.care");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await post("/api/auth/login", { email, password });
      setUser(r.user);
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-950 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h1 className="mb-1 text-2xl font-bold text-blue-900">CareRoster</h1>
        <p className="mb-4 text-sm text-slate-500">
          NDIS care &amp; rostering — demo build
        </p>
        {error && (
          <div className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="space-y-3">
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
          <Field label="Password">
            <input
              className={inputCls}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Btn className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Btn>
        </div>
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 text-xs font-medium text-slate-500">
            Demo accounts (password: demo1234)
          </p>
          <div className="flex flex-wrap gap-1">
            {DEMO_ACCOUNTS.map(([e, label]) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmail(e)}
                className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
