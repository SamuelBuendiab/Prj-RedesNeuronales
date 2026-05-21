import axios from "axios";
import { ArrowLeft, Cpu, Lock, User } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { setAuthToken } from "../api/client.js";

export default function Register() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await api.post("/register", { username, password });
      const { data } = await api.post("/login", { username, password });
      localStorage.setItem("carsia_token", data.access_token);
      localStorage.setItem("carsia_user", username);
      setAuthToken(data.access_token);
      navigate("/dashboard", { replace: true });
    } catch (ex) {
      const msg =
        axios.isAxiosError(ex) && ex.response?.data?.detail
          ? String(ex.response.data.detail)
          : "No se pudo registrar.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
          <Cpu className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
        <p className="mt-1 text-sm text-slate-400">Regístrate para usar CarsIA</p>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-card backdrop-blur">
        <Link
          to="/login"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al login
        </Link>

        <form onSubmit={onSubmit} className="mt-2 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Usuario</label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none ring-blue-500/40 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2"
                placeholder="Elige un usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={2}
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-200">Contraseña</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none ring-blue-500/40 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2"
                placeholder="Mínimo 4 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={4}
              />
            </div>
          </div>

          {err ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:opacity-60"
          >
            {loading ? "Creando…" : "Registrarse"}
          </button>
        </form>
      </div>
    </div>
  );
}
