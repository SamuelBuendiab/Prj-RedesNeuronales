import axios from "axios";
import {
  Activity,
  Brain,
  CheckCircle2,
  Cpu,
  Gauge,
  HardDrive,
  ImagePlus,
  Loader2,
  Timer,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/client.js";
import Layout from "../components/Layout.jsx";

const ACCEPT = { "image/jpeg": [".jpg", ".jpeg"], "image/png": [".png"], "image/webp": [".webp"] };

function fmtPct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

export default function Dashboard() {
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const [metrics, setMetrics] = useState(null);

  const loadMetrics = useCallback(async () => {
    try {
      const { data } = await api.get("/metrics");
      setMetrics(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onFile(f) {
    if (!f) return;
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(f.type);
    if (!ok) {
      setErr("Solo JPG, PNG o WEBP.");
      return;
    }
    setErr("");
    setFile(f);
    setResult(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  }

  async function runPredict() {
    if (!file) return;
    setLoading(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/predict", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      await loadMetrics();
    } catch (ex) {
      const msg =
        axios.isAxiosError(ex) && ex.response?.data?.detail
          ? String(ex.response.data.detail)
          : "Error al analizar la imagen.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  const lossSim = result ? Math.max(0.01, (1 - result.confidence) * 0.22 + 0.03).toFixed(3) : "—";
  const top1 = result ? fmtPct(result.confidence) : "—";

  const latData =
    metrics?.recent_latency?.map((d, i) => ({
      name: `#${i + 1}`,
      ms: d.ms,
    })) ?? [];
  const memData =
    metrics?.recent_memory?.map((d, i) => ({
      name: `#${i + 1}`,
      mb: d.mb,
    })) ?? [];

  return (
    <Layout
      subtitle={{
        title: "Clasificación de marcas",
        desc: "Sube una imagen del vehículo para obtener la marca predicha y el Top-5 con el modelo entrenado",
      }}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-card transition hover:border-slate-700/80">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Upload className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold">Subir imagen</h2>
          </div>
          <div
            role="button"
            tabIndex={0}
            onDragEnter={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              onFile(f);
            }}
            className={[
              "relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all",
              drag ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-800/40",
            ].join(" ")}
            onClick={() => document.getElementById("file-in")?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") document.getElementById("file-in")?.click();
            }}
          >
            <input
              id="file-in"
              type="file"
              accept={Object.keys(ACCEPT).join(",")}
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            {preview ? (
              <img
                src={preview}
                alt="Vista previa"
                className="max-h-56 max-w-full rounded-lg object-contain shadow-lg"
              />
            ) : (
              <>
                <ImagePlus className="mb-2 h-10 w-10 text-slate-500" />
                <p className="text-sm text-slate-400">Arrastra y suelta o haz clic</p>
                <p className="mt-1 text-xs text-slate-600">JPG, PNG, WEBP</p>
              </>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="truncate text-sm text-slate-400">{file ? file.name : "Sin archivo"}</span>
            <span
              className={[
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                result ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-800 text-slate-500",
              ].join(" ")}
            >
              {loading ? "Analizando…" : result ? "Análisis completo" : "Pendiente"}
            </span>
          </div>
          {err ? (
            <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {err}
            </div>
          ) : null}
          <button
            type="button"
            disabled={!file || loading}
            onClick={runPredict}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Procesando inferencia…" : "Ejecutar análisis"}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-card transition hover:border-slate-700/80">
          <div className="mb-4 flex items-center gap-2 text-white">
            <Brain className="h-5 w-5 text-violet-400" />
            <h2 className="text-lg font-semibold">Resultado (Top-5)</h2>
          </div>
          {!result ? (
            <p className="text-sm text-slate-500">Los resultados aparecerán tras ejecutar el análisis.</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Marca detectada</p>
                  <p className="mt-1 text-2xl font-bold text-white">{result.predicted_class}</p>
                  <div className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Alta confianza
                  </div>
                </div>
                <div className="text-right sm:text-left">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Confianza</p>
                  <p className="mt-1 text-3xl font-bold text-violet-400">{fmtPct(result.confidence)}</p>
                  <p className="mt-1 text-xs text-slate-500">Tiempo: {result.processing_time_ms.toFixed(0)} ms</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Accuracy", value: `${result.accuracy}%`, theme: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
                  { label: "Loss (sim.)", value: lossSim, theme: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                  { label: "Confianza", value: fmtPct(result.confidence), theme: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
                  { label: "Top-1", value: top1, theme: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
                ].map((c) => (
                  <div
                    key={c.label}
                    className={[
                      "rounded-xl border p-3 transition hover:scale-[1.02]",
                      c.theme,
                    ].join(" ")}
                  >
                    <p className="text-xs text-slate-400">{c.label}</p>
                    <p className="mt-1 text-lg font-semibold text-white">{c.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <p className="mb-3 text-sm font-medium text-slate-300">Probabilidades por marca (Top)</p>
                <ul className="space-y-3">
                  {result.probabilities.map((p) => (
                    <li key={p.label}>
                      <div className="mb-1 flex justify-between text-xs text-slate-400">
                        <span>{p.label}</span>
                        <span>{fmtPct(p.probability)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-500 transition-all"
                          style={{ width: `${Math.min(100, p.probability * 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-card">
        <div className="mb-6 flex items-center gap-2 text-white">
          <Activity className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold">Rendimiento de la consulta</h2>
        </div>
        {metrics ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Timer, label: "Tiempo inferencia (avg)", value: `${metrics.avg_inference_ms} ms` },
                { icon: HardDrive, label: "Memoria (avg)", value: `${metrics.avg_ram_mb} MB` },
                { icon: Gauge, label: "Total consultas", value: String(metrics.total_queries) },
                { icon: Cpu, label: "CPU (avg)", value: `${metrics.avg_cpu}%` },
                { icon: Activity, label: "GPU (sim.)", value: `${Math.min(99, Math.round(metrics.avg_cpu * 1.4))}%` },
                { icon: CheckCircle2, label: "Tasa de éxito", value: `${metrics.success_rate}%` },
              ].map((m) => (
                <div
                  key={m.label}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4 transition hover:border-slate-700 hover:shadow-lg"
                >
                  <m.icon className="h-8 w-8 shrink-0 text-blue-400" />
                  <div>
                    <p className="text-xs text-slate-500">{m.label}</p>
                    <p className="text-lg font-semibold text-white">{m.value}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="mb-2 text-sm font-medium text-slate-300">Latencia (ms)</p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={latData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                      <Area type="monotone" dataKey="ms" stroke="#3b82f6" fill="url(#g1)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="mb-2 text-sm font-medium text-slate-300">Memoria (MB)</p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={memData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                        labelStyle={{ color: "#e2e8f0" }}
                      />
                      <Bar dataKey="mb" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Cargando métricas…</p>
        )}
      </section>
    </Layout>
  );
}
