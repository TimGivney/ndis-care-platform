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

// ---------- offline queue ----------
// Failed POSTs queue in localStorage and retry when the network returns.
// Used for check-in/out and note saves — the stuff that can't be lost
// when a worker loses signal in a client's home.

const QUEUE_KEY = "careroster.offline_queue";

interface QueuedReq { path: string; body: unknown; queued_at: string }

export function pendingQueue(): QueuedReq[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"); }
  catch { return []; }
}

function saveQueue(q: QueuedReq[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  window.dispatchEvent(new Event("offline-queue-changed"));
}

/** POST that falls back to the offline queue on network failure. Returns
 * null when queued (caller treats it like success-with-caveat). */
export async function postOrQueue<T = any>(
  path: string, body?: unknown,
): Promise<T | null> {
  try {
    return await post<T>(path, body);
  } catch (e) {
    if (e instanceof TypeError) {  // fetch network failure
      const q = pendingQueue();
      q.push({ path, body, queued_at: new Date().toISOString() });
      saveQueue(q);
      return null;
    }
    throw e;
  }
}

export async function flushQueue(): Promise<number> {
  const q = pendingQueue();
  const left: QueuedReq[] = [];
  let sent = 0;
  for (const r of q) {
    try { await post(r.path, r.body); sent++; }
    catch (e) { if (e instanceof TypeError) left.push(r); }
  }
  saveQueue(left);
  return sent;
}

export async function upload<T = any>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    body: form,
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
