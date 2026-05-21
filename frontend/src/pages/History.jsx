import axios from "axios";
import { Calendar, ImageIcon, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import api, { setAuthToken } from "../api/client.js";
import Layout from "../components/Layout.jsx";

function AuthImage({ filename }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let cancelled = false;
    let objUrl = null;
    (async () => {
      try {
        const token = localStorage.getItem("carsia_token");
        setAuthToken(token);
        const res = await api.get(`/uploads/${encodeURIComponent(filename)}`, {
          responseType: "blob",
        });
        if (cancelled) return;
        objUrl = URL.createObjectURL(res.data);
        setSrc(objUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [filename]);

  if (!src) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-800">
        <ImageIcon className="h-8 w-8 text-slate-600" />
      </div>
    );
  }
  return <img src={src} alt="" className="h-20 w-20 rounded-lg object-cover" />;
}

export default function History() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setErr("");
    try {
      const { data } = await api.get("/history", {
        params: debounced ? { q: debounced } : {},
      });
      setRows(data);
    } catch (ex) {
      const msg = axios.isAxiosError(ex) ? "No se pudo cargar el historial." : "Error.";
      setErr(msg);
    }
  }, [debounced]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Layout
      subtitle={{
        title: "Historial de predicciones",
        desc: "Predicciones anteriores: marca, confianza y fecha",
      }}
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            placeholder="Buscar por clase o archivo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {err ? (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {err}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.length === 0 ? (
          <p className="text-slate-500">No hay predicciones aún.</p>
        ) : (
          rows.map((r) => (
            <article
              key={r.id}
              className="flex gap-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-card transition hover:border-slate-700"
            >
              <AuthImage filename={r.image_path} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">{r.predicted_class}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{r.image_path}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="text-violet-400">{(r.confidence * 100).toFixed(1)}%</span> confianza
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {new Date(r.created_at).toLocaleString("es")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Accuracy: {r.accuracy}% · {r.processing_time_ms.toFixed(0)} ms
                </p>
              </div>
            </article>
          ))
        )}
      </div>
    </Layout>
  );
}
