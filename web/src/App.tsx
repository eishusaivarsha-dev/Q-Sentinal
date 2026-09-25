import { useEffect, useState } from "react";
import { api, subscribeTelemetry, type AttackRun, type TelemetryEvent } from "./api";
import AlertFeed from "./components/AlertFeed";
import AttackPanel from "./components/AttackPanel";
import BlochSphere from "./components/BlochSphere";
import ChannelChart from "./components/ChannelChart";
import VerdictCard from "./components/VerdictCard";

export default function App() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [lastRun, setLastRun] = useState<AttackRun | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
    return subscribeTelemetry((e) => setEvents((prev) => [...prev.slice(-499), e]));
  }, []);

  const verdicts = events.filter((e) => e.kind === "verdict");

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Q-SENTINEL <span className="text-slate-400 font-normal">SOC console</span>
        </h1>
        <p className="text-sm text-slate-400">
          {health
            ? `backend ${health.backend} · ${health.basis_set} · L=${health.hash_bits} n=${health.rounds_per_bit} · ${health.pqc}`
            : "API offline: start it with  uvicorn qsentinel.api.main:app"}
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <AttackPanel onResult={setLastRun} />
          <BlochSphere />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <ChannelChart verdicts={verdicts} />
          {lastRun && <VerdictCard run={lastRun} />}
          <AlertFeed verdicts={verdicts} />
        </div>
      </div>
    </div>
  );
}
