import { Activity, Cpu, LayoutDashboard, LogOut, User } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { setAuthToken } from "../api/client.js";

export default function Layout({ children, subtitle }) {
  const navigate = useNavigate();
  const username = localStorage.getItem("carsia_user") || "usuario";

  function logout() {
    localStorage.removeItem("carsia_token");
    localStorage.removeItem("carsia_user");
    setAuthToken(null);
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-6">
            <Link to="/dashboard" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-lg shadow-blue-600/25">
                <Cpu className="h-5 w-5 text-white" />
              </span>
              <span className="text-lg font-semibold tracking-tight text-white">CarsIA</span>
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  [
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                  ].join(" ")
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </span>
              </NavLink>
              <NavLink
                to="/historial"
                className={({ isActive }) =>
                  [
                    "rounded-full px-3 py-1.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-200",
                  ].join(" ")
                }
              >
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  Historial
                </span>
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1.5 sm:flex">
              <User className="h-4 w-4 text-slate-400" />
              <span className="text-sm text-slate-200">{username}</span>
            </div>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-600 hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        {subtitle ? (
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{subtitle.title}</h1>
            <p className="mt-1 text-slate-400">{subtitle.desc}</p>
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
