import { createContext, useContext, useEffect, useRef, useState } from "react";
import {
  Bell, CalendarCheck, CalendarDays, Clock, Ellipsis, HeartHandshake, House, Inbox,
  LayoutDashboard, LogOut, LucideIcon, Megaphone, MessageCircle, NotebookPen,
  ScrollText, Settings2, ShieldAlert, Users,
} from "lucide-react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";

import { get, post, User } from "./lib/api";
import { Notification } from "./lib/types";
import { Avatar, BrandMark } from "./lib/ui";
import Audit from "./pages/Audit";
import Board from "./pages/Board";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
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
        className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        onClick={() => setOpen(!open)}
        title="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
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

type NavItem = { href: string; label: string; icon: LucideIcon };

function navFor(role: User["role"]): { main: NavItem[]; more: NavItem[] } {
  if (role === "worker") return {
    main: [
      { href: "/", label: "My shifts", icon: CalendarCheck },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/board", label: "Board", icon: Megaphone },
      { href: "/timesheets", label: "Hours", icon: Clock },
    ],
    more: [
      { href: "/incidents", label: "Incidents", icon: ShieldAlert },
      { href: "/requests", label: "Requests", icon: Inbox },
      { href: "/settings", label: "Settings", icon: Settings2 },
    ],
  };
  if (role === "participant") return {
    main: [
      { href: "/", label: "Home", icon: House },
      { href: "/roster", label: "My supports", icon: CalendarDays },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/requests", label: "Requests", icon: Inbox },
    ],
    more: [
      { href: "/board", label: "Board", icon: Megaphone },
      { href: "/incidents", label: "Incidents", icon: ShieldAlert },
      { href: "/settings", label: "Settings", icon: Settings2 },
    ],
  };
  return {
    main: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/roster", label: "Roster", icon: CalendarDays },
      { href: "/participants", label: "Participants", icon: HeartHandshake },
      { href: "/workers", label: "Workers", icon: Users },
    ],
    more: [
      { href: "/today", label: "Today's shifts", icon: CalendarCheck },
      { href: "/notes", label: "Notes", icon: NotebookPen },
      { href: "/incidents", label: "Incidents", icon: ShieldAlert },
      { href: "/requests", label: "Requests", icon: Inbox },
      { href: "/timesheets", label: "Timesheets", icon: Clock },
      { href: "/messages", label: "Messages", icon: MessageCircle },
      { href: "/board", label: "Board", icon: Megaphone },
      { href: "/audit", label: "Audit log", icon: ScrollText },
      { href: "/settings", label: "Settings", icon: Settings2 },
    ],
  };
}

const ROLE_LABEL = {
  admin: "Admin", manager: "Manager", worker: "Support worker", participant: "Participant",
} as const;

function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const [loc, navigate] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => { setMoreOpen(false); }, [loc]);
  if (!user) return null;
  const { main, more } = navFor(user.role);
  const active = (h: string) => (h === "/" ? loc === "/" : loc === h || loc.startsWith(h + "/"));
  const moreActive = more.some((n) => active(n.href));
  const roleLabel = ROLE_LABEL[user.role];
  const logout = async () => {
    await post("/api/auth/logout");
    setUser(null);
    navigate("/login");
  };

  return (
    <div className="min-h-screen sm:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white px-3 py-5 sm:flex">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <BrandMark />
          <span className="text-[17px] font-semibold tracking-tight text-slate-900">CareRoster</span>
        </Link>
        <nav className="mt-7 flex-1 space-y-0.5 overflow-y-auto">
          {[...main, ...more].map((n) => (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${active(n.href) ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}>
              <n.icon size={18} strokeWidth={active(n.href) ? 2.25 : 1.75} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-3 flex items-center gap-3 border-t border-slate-100 px-2 pt-4">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-500">{roleLabel}</div>
          </div>
          <button onClick={logout} title="Log out"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200/70 bg-white/85 px-4 backdrop-blur sm:justify-end">
          <Link href="/" className="flex items-center gap-2 sm:hidden">
            <BrandMark size={28} />
            <span className="font-semibold tracking-tight text-slate-900">CareRoster</span>
          </Link>
          <NotifBell />
        </header>
        <main>{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {main.map((n) => (
          <Link key={n.href} href={n.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(n.href) ? "text-teal-700" : "text-slate-400"}`}>
            <n.icon size={22} strokeWidth={active(n.href) ? 2.25 : 1.75} />
            {n.label}
          </Link>
        ))}
        <button onClick={() => setMoreOpen(true)}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${moreActive ? "text-teal-700" : "text-slate-400"}`}>
          <Ellipsis size={22} />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/30 sm:hidden" onClick={() => setMoreOpen(false)}>
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-3 flex items-center gap-3 px-2">
              <Avatar name={user.name} />
              <div>
                <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                <div className="text-xs text-slate-500">{roleLabel}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {more.map((n) => (
                <Link key={n.href} href={n.href}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-xs font-medium ${active(n.href) ? "bg-teal-50 text-teal-800" : "bg-slate-50 text-slate-600"}`}>
                  <n.icon size={22} strokeWidth={1.75} />
                  {n.label}
                </Link>
              ))}
            </div>
            <button onClick={logout}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium text-rose-600 hover:bg-rose-50">
              <LogOut size={16} /> Log out
            </button>
          </div>
        </div>
      )}
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
                <Route path="/" component={user.role === "worker" ? Today : user.role === "participant" ? Home : Dashboard} />
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
