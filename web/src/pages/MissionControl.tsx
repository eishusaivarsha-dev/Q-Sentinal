// The analyst's 60-second screen (docs/frontend-spec.md §4.1).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, errorText } from "../api/client";
import type { LinkStatus } from "../api/types";
import EllipseThumb from "../components/EllipseThumb";
import { Sparkline } from "../components/SeriesChart";
import { Button, Card, DecisionPill, Empty, ErrorNote, Pill, Stat } from "../components/ui";
import { classOfEvent } from "../lib/attribution";
import { verdictEvents } from "../lib/events";
import { ago, pct } from "../lib/physics";
import { useSession } from "../state/session";
import { useTelemetry } from "../state/telemetry";

const QUICK: [string, string, number | null, Record<string, unknown>?][] = [
  ["Honest signature", "honest", null],
  ["Forgery", "blind_forgery", null],
  ["Eavesdropper 50%", "intercept_resend", 0.5],
  ["Stealth probe", "stealth_probe", null],
  ["Replay", "replay", null],
  ["Stolen key", "stolen_key_honeypot", null],
];

function QuickActions() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const run = useMutation({
    mutationFn: ({ attack, strength }: { attack: string; strength: number | null }) => api.runAttack({ attack, strength }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <Card title="Quick demo" right={run.isPending ? <Pill tone="info">running…</Pill> : run.data && <Pill tone={run.data.result === "PASS" ? "ok" : "bad"}>{run.data.attack}: {run.data.decision}</Pill>}>
      <div className="flex flex-wrap gap-2">
        {QUICK.map(([label, attack, strength]) => (
          <Button key={attack} variant={attack === "honest" ? "ok" : "danger"} disabled={run.isPending || replay}
            onClick={() => run.mutate({ attack, strength })}>{label}</Button>
        ))}
      </div>
      {run.error && <p className="mt-2 text-sm text-rose-300">{errorText(run.error)}</p>}
    </Card>
  );
}

function LinkCard({ name, link }: { name: string; link: LinkStatus }) {
  const tone = link.status === "critical" ? "bad" : link.status === "warning" ? "warn" : link.status === "healthy" ? "ok" : "neutral";
  const cusumShare = Math.min(1, (link.latest?.cusum ?? 0) / 0.03);
  const baseline = { Z: link.baseline.per_basis["0"][0] / link.baseline.per_basis["0"][1], X: link.baseline.per_basis["1"][0] / link.baseline.per_basis["1"][1], Y: (link.baseline.per_basis["2"]?.[0] ?? 0) / (link.baseline.per_basis["2"]?.[1] || 1) };
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-sm">{name}</p>
        <Pill tone={tone}>{link.status}</Pill>
      </div>
      <div className="mt-2 flex gap-3">
        <EllipseThumb rates={link.latest?.rates ?? null} baseline={baseline} />
        <div className="min-w-0 flex-1 space-y-1 text-xs">
          <p className="text-slate-400">QBER {pct(link.latest?.qber)} <span className="text-slate-500">(normal {pct(link.baseline.qber)})</span></p>
          <Sparkline values={link.history.map((h) => h.qber)} threshold={0.11} />
          <p className="text-slate-400">CHSH <b className="text-slate-100">{link.latest?.chsh?.toFixed(2) ?? "–"}</b> · checks {link.verifications} · CUSUM alarms {link.cusum_alarms}</p>
          <div className="h-1.5 rounded bg-slate-800"><div className={`h-1.5 rounded ${cusumShare >= 1 ? "bg-rose-500" : "bg-amber-400"}`} style={{ width: `${cusumShare * 100}%` }} /></div>
        </div>
      </div>
      <p className={`mt-2 truncate text-xs ${link.latest?.fingerprint_drift ? "text-amber-300" : "text-slate-400"}`} title={link.latest?.fingerprint}>{link.latest?.fingerprint ?? "no verifications yet"}</p>
    </div>
  );
}

export default function MissionControl() {
  const navigate = useNavigate();
  const ov = useQuery({ queryKey: ["overview"], queryFn: api.overview, refetchInterval: 3000 });
  const links = useQuery({ queryKey: ["links", 40], queryFn: () => api.links(40), refetchInterval: 3000 });
  const audit = useQuery({ queryKey: ["audit"], queryFn: api.audit, refetchInterval: 5000 });
  const events = useTelemetry((s) => s.events);
  const disputed = new Set(audit.data?.disputes.map((d) => d.key_id) ?? []);
  const feed = verdictEvents(events).slice(-30).reverse();
  const o = ov.data;
  const linkCounts = Object.values(o?.links ?? {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Mission Control</h1>
        <p className="text-sm text-slate-400">Is everything OK right now? Every number links to a certificate or ledger entry.</p>
      </div>
      {ov.error && <ErrorNote error={ov.error} hint="Start the backend: uvicorn qsentinel.api.main:app --reload" />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Verdicts" value={o?.verdicts.total ?? "–"} sub={o && `${o.verdicts.accept} accepted · ${o.verdicts.reject} rejected`} />
        <Stat label="Critical alerts" value={o?.alerts.critical ?? "–"} tone={o?.alerts.critical ? "bad" : "ok"} />
        <Stat label="Warnings" value={o?.alerts.warning ?? "–"} tone={o?.alerts.warning ? "warn" : "ok"} />
        <Stat label="Links" value={linkCounts.length || "–"} sub={`${linkCounts.filter((s) => s === "healthy").length} healthy · ${linkCounts.filter((s) => s === "warning").length} warning · ${linkCounts.filter((s) => s === "critical").length} critical`}
          tone={linkCounts.includes("critical") ? "bad" : linkCounts.includes("warning") ? "warn" : "ok"} />
        <Stat label="Ledger" value={o ? (o.ledger.chain_ok ? "valid ✓" : "BROKEN") : "–"} tone={o ? (o.ledger.chain_ok ? "ok" : "bad") : undefined}
          sub={o && `${o.ledger.entries} entries · ${o.ledger.anchors} Merkle anchors`} />
        <Stat label="Disputes" value={o?.disputes ?? "–"} tone={o?.disputes ? "bad" : "ok"} sub="transferability violations" />
      </div>
      <QuickActions />
      <div className="grid gap-4 xl:grid-cols-5">
        <Card title="Links" className="xl:col-span-2">
          {links.data && Object.keys(links.data).length ? (
            <div className="grid gap-3">{Object.entries(links.data).map(([n, l]) => <LinkCard key={n} name={n} link={l} />)}</div>
          ) : <Empty>No link commissioned yet. Run an honest signature above.</Empty>}
        </Card>
        <Card title="Live alert feed" className="xl:col-span-3" right={<span className="text-xs text-slate-500">newest first</span>}>
          {feed.length ? (
            <ul className="divide-y divide-slate-800">
              {feed.map((e) => {
                const cls = classOfEvent(e.data, disputed);
                return (
                  <li key={e.seq}>
                    <button className="flex w-full flex-wrap items-center gap-2 py-2 text-left text-sm hover:bg-slate-800/50" onClick={() => navigate(`/verdicts/${e.data.ledger_index}`)}>
                      <span className="w-16 text-xs text-slate-500">{ago(e.ts)}</span>
                      <DecisionPill decision={e.data.decision} />
                      <Pill tone={cls.tone}>{cls.label}</Pill>
                      <span className="font-mono text-xs text-slate-400">{e.data.link}</span>
                      <span className="flex gap-1">{e.data.alerts.map((a) => <Pill key={a.detector} tone={a.severity === "critical" ? "bad" : "warn"}>{a.detector}</Pill>)}</span>
                      <span className="ml-auto text-xs text-slate-500">#{e.data.ledger_index}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <Empty>No verifications yet.</Empty>}
        </Card>
      </div>
    </div>
  );
}
