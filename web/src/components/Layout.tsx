import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import PresenterMode from "../demo/PresenterMode";
import { downloadJson, useSession } from "../state/session";
import { stopReplay, useTelemetry, useTelemetryConnection } from "../state/telemetry";
import { useUi } from "../state/ui";
import { Pill } from "./ui";

const NAV = [
  ["/", "Mission Control"],
  ["/journey", "Signature Journey"],
  ["/attacks", "Attack Lab"],
  ["/verdicts", "Verdict Inspector"],
  ["/channels", "Channel Observatory"],
  ["/ledger", "Ledger Explorer"],
  ["/transferability", "Transferability Arena"],
  ["/bounds", "Security Bounds"],
  ["/ops", "Ops Plane (AI)"],
  ["/settings", "Settings"],
] as const;

function TopBar() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 15000 });
  const status = useTelemetry((s) => s.status);
  const { recording, replay, start, stop } = useSession();
  const setPresenter = useUi((s) => s.setPresenter);
  const h = health.data;
  const dot = { live: "bg-emerald-400", connecting: "bg-amber-400", down: "bg-rose-500", replay: "bg-violet-400" }[status];
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-2 backdrop-blur">
      <Link to="/" className="text-lg font-bold tracking-tight">Q-SENTINEL <span className="font-normal text-slate-400">Trust Console</span></Link>
      <span className="flex items-center gap-1.5 text-xs text-slate-400"><span className={`h-2.5 w-2.5 rounded-full ${dot}`} />{status === "live" ? "live" : status}</span>
      {h ? (
        <span className="hidden text-xs text-slate-400 lg:inline">
          {h.backend} · {h.basis_set} · L={h.hash_bits} n={h.rounds_per_bit} · τ {h.tau}/{h.tau_transfer} · ML-DSA {h.pqc} · {h.kem}
        </span>
      ) : (
        !replay && <span className="text-xs text-rose-300">API offline – start it with: uvicorn qsentinel.api.main:app</span>
      )}
      {h?.auth === "dev-open" && <Pill tone="warn">DEV MODE</Pill>}
      {replay && <Pill tone="info">REPLAY</Pill>}
      <div className="ml-auto flex items-center gap-2">
        <Pill tone="ok" className="border-cyan-600 bg-cyan-950 text-cyan-200">AI in trust path: NO</Pill>
        {replay ? (
          <button className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800" onClick={stopReplay}>Exit replay</button>
        ) : recording ? (
          <button className="rounded-md bg-rose-700 px-2 py-1 text-xs" onClick={() => downloadJson(`qsentinel-session-${Date.now()}.json`, stop())}>■ Stop & save session</button>
        ) : (
          <button className="rounded-md border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800" onClick={start}>● Record session</button>
        )}
        <button className="rounded-md bg-cyan-600 px-3 py-1 text-xs font-semibold hover:bg-cyan-500" onClick={() => setPresenter(true)}>Presenter Mode</button>
      </div>
    </header>
  );
}

function Toasts() {
  const { toasts, dismiss } = useTelemetry();
  const presenter = useUi((s) => s.presenter);
  const navigate = useNavigate();
  return (
    <div className={`fixed right-4 z-30 flex w-80 flex-col gap-2 ${presenter ? "top-16" : "bottom-4"}`}>
      {toasts.map((t) => (
        <div key={t.id} className="rounded-lg border border-rose-700 bg-rose-950/95 p-3 text-sm shadow-lg">
          <div className="flex justify-between gap-2">
            <b className="text-rose-200">{t.title}</b>
            <button className="text-rose-300" aria-label="dismiss" onClick={() => dismiss(t.id)}>×</button>
          </div>
          <p className="mt-1 text-rose-100/90">{t.body}</p>
          {t.ledgerIndex !== undefined && (
            <button className="mt-1 text-xs text-cyan-300 underline" onClick={() => { dismiss(t.id); navigate(`/verdicts/${t.ledgerIndex}`); }}>Open proof →</button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function Layout() {
  useTelemetryConnection();
  const presenter = useUi((s) => s.presenter);
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <TopBar />
      <div className="flex">
        <nav className="sticky top-12 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col gap-1 border-r border-slate-800 p-3 md:flex">
          {NAV.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm ${isActive ? "bg-cyan-900/60 text-cyan-200" : "text-slate-300 hover:bg-slate-800"}`}>
              {label}
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-6">
          <nav className="mb-4 flex gap-2 overflow-x-auto md:hidden">
            {NAV.map(([to, label]) => (
              <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `whitespace-nowrap rounded-full px-3 py-1 text-xs ${isActive ? "bg-cyan-800" : "bg-slate-800"}`}>{label}</NavLink>
            ))}
          </nav>
          <Outlet />
        </main>
      </div>
      <Toasts />
      {presenter && <PresenterMode />}
    </div>
  );
}
