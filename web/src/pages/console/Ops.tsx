// AI operations plane (docs/frontend-spec.md §4.9), advisory only: incident clustering, channel
// forecasts, unusual verifications, the fraud queue and the Sentinel Copilot. Every panel here is
// labelled ADVISORY; none of it can change a verdict.
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, BrainCircuit, Layers, LineChart, Lock, ShieldAlert, Sparkles, Telescope } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useFraudQueue } from "@/api/hooks";
import type { LinkForecast } from "@/api/types";
import { cn } from "@/lib/cn";
import { ago, pct } from "@/lib/format";
import { Reveal } from "@/fx/motion";
import SeriesChart from "@/components/charts";
import CopilotChat from "@/components/copilot/CopilotChat";
import { to } from "@/components/shell/nav";
import { Card, Chip, DecisionBadge, DetectorChip, Empty, ErrorNote, PageHeader, Skeleton, Stat, type Tone } from "@/components/ui";

const RISK_TONE: Record<LinkForecast["risk"], Tone> = { high: "bad", elevated: "warn", watch: "info", low: "ok", unknown: "neutral" };
const HINT = "Start the advisory service: uvicorn qsentinel_ops.server:app --port 8100";

function ForecastCard({ f }: { f: LinkForecast }) {
  const q = f.qber;
  const data = q ? [
    ...q.history.map((v, i) => ({ i: i - q.history.length + 1, history: v })),
    ...q.forecast.map((v, i) => ({ i: i + 1, forecast: v, low: Math.max(0, q.low[i]), high: q.high[i] })),
  ] : [];
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="data text-[15px] font-semibold text-ink">{f.link}</span>
        <Chip tone={RISK_TONE[f.risk]} dot>risk {f.risk}</Chip>
      </div>
      {q ? (
        <>
          <SeriesChart data={data} height={170} refs={[{ y: 0.11, label: "alarm" }]}
            lines={[{ key: "history", name: "QBER", token: "brand" }, { key: "forecast", name: "forecast", token: "violet", dashed: true }, { key: "high", name: "80% band", token: "ink-3", dashed: true }]} />
          <p className="mt-1 text-[13px] text-ink-3">now {pct(q.level, 2)} · trend {q.trend >= 0 ? "+" : ""}{(q.trend * 100).toFixed(2)} pts / verification · {f.steps_to_breach === 0 ? "past a threshold" : f.steps_to_breach ? `~${f.steps_to_breach} verifications to a threshold` : "no breach projected"}</p>
        </>
      ) : <p className="text-[14px] text-ink-3">{f.note}</p>}
    </div>
  );
}

export default function Ops() {
  const incidents = useQuery({ queryKey: ["incidents"], queryFn: api.incidents, refetchInterval: 8000, retry: false });
  const forecast = useQuery({ queryKey: ["forecast"], queryFn: api.forecast, refetchInterval: 10_000, retry: false });
  const anomalies = useQuery({ queryKey: ["anomalies"], queryFn: api.anomalies, refetchInterval: 10_000, retry: false });
  const fraud = useFraudQueue(25, false);
  const inc = incidents.data;

  return (
    <div>
      <PageHeader eyebrow="Assist · advisory AI" title="AI Ops &" accent="Copilot"
        lede="Machine learning where it helps and can't hurt: it clusters alert storms, forecasts the links, finds unusual verifications and flags suspected fraud for you to decide. It reads telemetry through a one-way valve and never touches a verdict." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Alerts" value={inc?.alerts} icon={ShieldAlert} sub="verifications with alarms" />
        <Stat label="Incidents" value={inc?.incidents.length} icon={Layers} sub={inc ? `${pct(inc.reduction, 0)} less noise (DBSCAN)` : "clustered"} tone="brand" />
        <Stat label="Unusual" value={anomalies.data?.anomalies.length} icon={Telescope} sub={anomalies.data ? `of ${anomalies.data.scored} scored (Isolation Forest)` : "ranked"} />
        <Stat label="Fraud to review" value={fraud.data?.open} icon={BrainCircuit} tone={fraud.data?.open ? "warn" : "ok"} sub="waiting for your decision" />
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Reveal>
          <section className="card flex h-[640px] flex-col overflow-hidden">
            <CopilotChat className="h-full" />
          </section>
        </Reveal>
        <div className="min-w-0 space-y-6">
          <Card glow title="Fraud review queue" sub="the AI suggests · you decide" icon={ShieldAlert}
            actions={<Link to={to("fraud")} className="link text-[14px]">Open <ArrowRight size={14} className="inline" /></Link>}>
            {fraud.error ? <ErrorNote error={fraud.error} hint={HINT} /> : !fraud.data ? <Skeleton className="h-40" /> : fraud.data.cases.length ? (
              <ul className="space-y-2">
                {fraud.data.cases.slice(0, 5).map((c) => (
                  <li key={c.ledger_index}>
                    <Link to={to(`fraud/${c.ledger_index}`)} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 transition hover:border-brand/40">
                      <span className={cn("data w-10 text-[16px] font-bold", c.level === "critical" ? "text-bad" : c.level === "high" ? "text-warn" : "text-brand-2")}>{c.risk}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[14.5px] font-semibold text-ink">{c.category}</span><span className="block text-[12.5px] text-ink-3">#{c.ledger_index} · {c.signer_id} · {ago(c.ts)}</span></span>
                      {c.review ? <Chip tone="ok" className="!text-[11.5px]">decided</Chip> : <Chip tone="warn" dot className="!text-[11.5px]">open</Chip>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty>No fraud indicators right now.</Empty>}
          </Card>
          <Card title="Trust boundary" icon={Lock}>
            <ul className="space-y-2.5 text-[14.5px] text-ink-2">
              {["Separate package and process (ops/); it never imports the trust kernel.", "Reads telemetry through read-only endpoints; no write path into detection.",
                "Every output is labelled ADVISORY - NOT A TRUST DECISION.", "Fraud decisions are made by a person and signed onto the ledger, with the AI's advice beside them.",
                "CI fails the build if an ML library reaches quantum/, qds/ or detect/."].map((t) => (
                <li key={t} className="flex gap-2.5"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />{t}</li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Incident triage" sub="alert storms clustered into incidents · narrated" icon={Layers} className="mb-6">
        {incidents.error ? <ErrorNote error={incidents.error} hint={HINT} /> : !inc ? <Skeleton className="h-40" /> : inc.incidents.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {inc.incidents.slice(0, 6).map((i, k) => (
              <motion.div key={i.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: k * 0.05 }} className="rounded-2xl border border-line bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={i.critical ? "bad" : "warn"}>{i.size} verification{i.size === 1 ? "" : "s"}</Chip>
                  {i.detectors.map((d) => <DetectorChip key={d} id={d} severity={i.critical ? "critical" : "warning"} />)}
                  <span className="ml-auto text-[13px] text-ink-3">{ago(i.last_ts)}</span>
                </div>
                <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">{i.narrative.replace(/^\[[^\]]+\]\s*/, "")}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {i.ledger_indices.filter((x): x is number => x !== null).slice(0, 8).map((x) => <Link key={x} to={to(`verdicts/${x}`)} className="data rounded-full border border-line px-2 py-0.5 text-[12px] text-brand hover:border-brand/40">#{x}</Link>)}
                </div>
              </motion.div>
            ))}
          </div>
        ) : <Empty>No alerts to cluster yet.</Empty>}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Channel forecast" sub="Holt smoothing · QBER projection with 80% band" icon={LineChart}>
          {forecast.error ? <ErrorNote error={forecast.error} hint={HINT} /> : !forecast.data ? <Skeleton className="h-60" /> : forecast.data.links.length ? (
            <div className="grid gap-4 lg:grid-cols-2">{forecast.data.links.map((f) => <ForecastCard key={f.link} f={f} />)}</div>
          ) : <Empty>No links yet.</Empty>}
        </Card>
        <Card title="Unusual verifications" sub="Isolation Forest over every verdict's physics" icon={Telescope}>
          {anomalies.error ? <ErrorNote error={anomalies.error} hint={HINT} /> : !anomalies.data ? <Skeleton className="h-60" /> : anomalies.data.anomalies.length ? (
            <ul className="space-y-2.5">
              {anomalies.data.anomalies.map((a) => (
                <li key={a.ledger_index} className="rounded-xl border border-line p-3">
                  <div className="flex items-center gap-2">
                    <Link className="link data text-[14px]" to={to(`verdicts/${a.ledger_index}`)}>#{a.ledger_index}</Link>
                    <DecisionBadge decision={a.decision} />
                    <span className="data ml-auto text-[13px] text-ink-3">score {a.score.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><motion.div className="h-full bg-violet" initial={{ width: 0 }} animate={{ width: `${a.score * 100}%` }} /></div>
                  <p className="mt-1.5 text-[13px] text-ink-3">{a.drivers.join(" · ")}</p>
                </li>
              ))}
            </ul>
          ) : <Empty icon={Sparkles}>{anomalies.data.note ?? "Nothing unusual."}</Empty>}
        </Card>
      </div>
    </div>
  );
}
