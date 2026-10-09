import { createContext, useContext, useEffect, useState } from "react";
import { Link, Redirect, Route, Switch, useLocation } from "wouter";

import { get, post, User } from "./lib/api";
import Audit from "./pages/Audit";
import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import Login from "./pages/Login";
import Notes from "./pages/Notes";
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
  { href: "/participants", label: "Participants", roles: ["admin", "manager"] },
  { href: "/workers", label: "Workers", roles: ["admin", "manager"] },
  { href: "/notes", label: "Notes", roles: ["admin", "manager"] },
  { href: "/incidents", label: "Incidents" },
  { href: "/requests", label: "Requests" },
  { href: "/timesheets", label: "Timesheets", roles: ["admin", "manager", "worker"] },
  { href: "/audit", label: "Audit Log", roles: ["admin", "manager"] },
];

function Layout({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const [, navigate] = useLocation();
  if (!user) return null;
  const nav = NAV.filter((n) => !n.roles || n.roles.includes(user.role));
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-blue-900 text-white shadow">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
          <Link href="/" className="mr-2 text-lg font-bold tracking-tight">
            CareRoster
          </Link>
          <nav className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-blue-100 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-blue-200">
              {user.name} · {user.role}
            </span>
            <button
              className="rounded bg-blue-800 px-2 py-1 hover:bg-blue-700"
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
                <Route path="/participants" component={Participants} />
                <Route path="/participants/:id" component={ParticipantDetail} />
                <Route path="/workers" component={Workers} />
                <Route path="/workers/:id" component={WorkerDetail} />
                <Route path="/notes" component={Notes} />
                <Route path="/incidents" component={Incidents} />
                <Route path="/requests" component={Requests} />
                <Route path="/timesheets" component={Timesheets} />
                <Route path="/audit" component={Audit} />
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
