export type Role = "admin" | "manager" | "worker" | "participant";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  org_id: number;
  worker_id: number | null;
  participant_id: number | null;
}

export async function api<T = any>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    credentials: "same-origin",
    headers: opts.body ? { "Content-Type": "application/json" } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const j = await res.json();
      msg = j.detail ?? msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const get = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body });
export const put = <T = any>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body });
export const del = <T = any>(path: string) => api<T>(path, { method: "DELETE" });
