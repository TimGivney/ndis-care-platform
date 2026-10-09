import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";

import { get, post, User } from "./lib/api";
import { Notification } from "./lib/types";
import Audit from "./pages/Audit";
import Board from "./pages/Board";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import Login from "./pages/Login";
import Messages from "./pages/Messages";
import Notes from "./pages/Notes";
import Settings from "./pages/Settings";
import ParticipantDetail from "./pages/ParticipantDetail";
import Participants from "./pages/Participants";
import Requests from "./pages/Requests";
import Roster from "./pages/Roster";
import Timesheets from "./pages/Timesheets";
import Today from "./pages/Today";
import WorkerDetail from "./pages/WorkerDetail";
import Workers from "./pages/Workers";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
}
const Auth = createContext<AuthCtx>({ user: null, loading: true, setUser: () => {} });
export const useAuth = () => useContext(Auth);

const NAV: { href: string; label: string; roles?: User["role"][] }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/today", label: "My Shifts", roles: ["worker"] },
  { href: "/roster", label: "Roster", roles: ["admin", "manager", "participant"] },
  { href: "/board", label: "Board" },
  { href: "/messages", label: "Messages" },
  { href: "/participants", label: "Participants", roles: ["admin", "manager"] },
  { href: "/workers", label: "Workers", roles: ["admin", "manager"] },
  { href: "/notes", label: "Notes", roles: ["admin", "manager"] },
  { href: "/incidents", label: "Incidents" },
  { href: "/requests", label: "Requests" },
  { href: "/timesheets", label: "Timesheets", roles: ["admin", "manager", "worker"] },
  { href: "/audit", label: "Audit Log", roles: ["admin", "manager"] },
  { href: "/settings", label: "Settings" },
];

function NotifBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  const load = () =>
    get<{ notifications: Notification[]; unread_count: number }>(
      "/api/notifications",
    ).then((r) => {
      setItems(r.notifications);
      setUnread(r.unread_count);
    }).catch(() => {});

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const clickItem = async (n: Notification) => {
    if (!n.read) await post(`/api/notifications/${n.id}/read`);
    setOpen(false);
    if (n.link) navigate(n.link);
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative rounded-full bg-teal-700/60 px-2.5 py-1 text-white hover:bg-teal-600"
        onClick={() => setOpen(!open)}
        title="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-teal-100 bg-white text-slate-800 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && (
              <button
                className="text-xs text-teal-700 hover:underline"
                onClick={async () => {
                  await post("/api/notifications/read-all");
                  load();
                }}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <p className="p-4 text-center text-sm text-slate-400">
                All caught up!
              </p>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => clickItem(n)}
                className={`block w-full border-b border-slate-50 px-3 py-2 text-left text-sm hover:bg-teal-50 ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <div className="font-medium">{n.title}</div>
                {n.body && (
                  <div className="truncate text-xs text-slate-500">{n.body}</div>
                )}
                <div className="mt-0.5 text-[10px] text-slate-400">
                  {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const [, navigate] = useLocation();
  if (!user) return null;
  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-gradient-to-r from-teal-700 to-emerald-600 text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/" className="mr-2 text-lg font-bold tracking-tight">
            CareRoster 💚
          </Link>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-teal-50 hover:text-white hover:underline">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <NotifBell />
            <span className="text-teal-100">
              {user.name} · {user.role}
            </span>
            <button
              className="rounded-full bg-teal-800/70 px-3 py-1 hover:bg-teal-800"
              onClick={async () => {
                await post("/api/auth/logout");
                setUser(null);
                navigate("/login");
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<{ user: User }>("/api/auth/me")
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading…</div>;
  }

  return (
    <Auth.Provider value={{ user, loading, setUser }}>
      <Switch>
        <Route path="/login">
          {user ? <Redirect to="/" /> : <Login />}
        </Route>
        <Route>
          {!user ? (
            <Redirect to="/login" />
          ) : (
            <Layout>
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/today" component={Today} />
                <Route path="/roster" component={Roster} />
                <Route path="/board" component={Board} />
                <Route path="/messages" component={Messages} />
                <Route path="/participants" component={Participants} />
                <Route path="/participants/:id" component={ParticipantDetail} />
                <Route path="/workers" component={Workers} />
                <Route path="/workers/:id" component={WorkerDetail} />
                <Route path="/notes" component={Notes} />
                <Route path="/incidents" component={Incidents} />
                <Route path="/requests" component={Requests} />
                <Route path="/timesheets" component={Timesheets} />
                <Route path="/audit" component={Audit} />
                <Route path="/settings" component={Settings} />
                <Route>
                  <div className="p-8 text-center text-slate-500">Page not found</div>
                </Route>
              </Switch>
            </Layout>
          )}
        </Route>
      </Switch>
    </Auth.Provider>
  );
}
