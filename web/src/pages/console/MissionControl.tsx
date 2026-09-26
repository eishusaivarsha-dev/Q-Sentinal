// The analyst's 60-second screen (docs/frontend-spec.md §4.1): a live 3-D network of the quantum
// links, what (if anything) is attacking them, and every verdict as it streams in.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Activity, AlertOctagon, Blocks, BrainCircuit, Gavel, Network, Radio, ShieldCheck, TriangleAlert, Zap } from "lucide-react";
import { lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAttacks, useDisputedKeys, useLinks, useOverview } from "@/api/hooks";
import type { LinkStatus } from "@/api/types";
import { attackCopy, classOfEvent, glyphForClass } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { verdictEvents } from "@/lib/events";
import { ago, pct } from "@/lib/format";
import { ellipsoidShape } from "@/lib/physics";
import { useSession } from "@/state/session";
import { useTelemetry } from "@/state/telemetry";
import { useUi } from "@/state/ui";
import { Reveal } from "@/fx/motion";
import { Sparkline } from "@/components/charts";
import { to } from "@/components/shell/nav";
import { AttackIcon, Card, Chip, ClassChip, DetectorChip, Empty, ErrorNote, Meter, PageHeader, Skeleton, Stat } from "@/components/ui";
import AlertFeed from "@/components/verdict/AlertFeed";
import ChshGauge from "@/components/verdict/ChshGauge";
import SignatureMatrix from "@/components/verdict/SignatureMatrix";

const QuantumNetwork = lazy(() => import("@/three/QuantumNetwork"));

const QUICK: [string, number | null][] = [
  ["honest", null], ["blind_forgery", null], ["intercept_resend", 0.5], ["stealth_probe", null], ["replay", null], ["stolen_key_honeypot", null],
];
const INCIDENT_WINDOW = 180;

function QuickActions() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const run = useMutation({
    mutationFn: ({ attack, strength }: { attack: string; strength: number | null }) => api.runAttack({ attack, strength }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <Card title="Quick actions" sub="POST /attacks/run · each runs the real pipeline" icon={Zap}
      actions={run.isPending ? <Chip tone="info" dot>transmitting…</Chip> : run.data && <Chip tone={run.data.result === "PASS" ? "ok" : "bad"}>{attackCopy(run.data.attack).label}: {run.data.decision}</Chip>}>
      <div className="flex flex-wrap gap-2.5">
        {QUICK.map(([attack, strength]) => {
          const copy = attackCopy(attack);
          return (
            <button key={attack} disabled={run.isPending || replay} onClick={() => run.mutate({ attack, strength })}
              className={cn("group flex items-center gap-2.5 rounded-2xl border py-2 pl-2 pr-4 text-[15px] font-semibold transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50",
                attack === "honest" ? "border-ok/30 bg-ok/8 text-ok hover:border-ok/60" : "border-line bg-surface-2 text-ink hover:border-bad/40 hover:text-bad")}>
              <AttackIcon glyph={copy.glyph} size={34} tone={attack === "honest" ? "ok" : "neutral"} />
              {copy.label}{strength !== null ? ` ${pct(strength, 0)}` : ""}
            </button>
          );
        })}
      </div>
      {run.error && <div className="mt-4"><ErrorNote error={run.error} /></div>}
      {replay && <p className="mt-3 text-[14px] text-ink-3">Replay mode: actions are disabled; browse the recorded session.</p>}
    </Card>
  );
}

function LinkCard({ name, link }: { name: string; link: LinkStatus }) {
  const nav = useNavigate();
  const tone = link.status === "critical" ? "bad" : link.status === "warning" ? "warn" : link.status === "healthy" ? "ok" : "neutral";
  const cusum = link.latest?.cusum ?? 0;
  return (
    <button onClick={() => nav(to("channels"), { state: { link: name } })} className="card card-hover min-w-0 p-5 text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="data truncate text-[16px] font-semibold text-ink">{name}</p>
        <Chip tone={tone} dot>{link.status}</Chip>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          <div className="label !text-[11.5px]">Error rate</div>
          <div className="data text-[22px] font-semibold text-ink">{pct(link.latest?.qber)}</div>
          <div className="text-[12.5px] text-ink-3">baseline {pct(link.baseline.qber)} · alarm 11%</div>
        </div>
        <div>
          <div className="label !text-[11.5px]">CHSH</div>
          <div className={cn("data text-[22px] font-semibold", (link.latest?.chsh ?? 3) <= 2 ? "text-bad" : "text-ink")}>{link.latest?.chsh?.toFixed(3) ?? "–"}</div>
          <div className="text-[12.5px] text-ink-3">{link.verifications} checks · {link.cusum_alarms} CUSUM alarms</div>
        </div>
      </div>
      <div className="mt-3"><Sparkline values={link.history.map((h) => h.qber)} threshold={0.11} token={tone === "bad" ? "bad" : "brand"} /></div>
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[12.5px] text-ink-3"><span>CUSUM drift</span><span className="data">{cusum.toFixed(3)} / 0.030</span></div>
        <Meter value={cusum} max={0.03} tone={cusum >= 0.03 ? "bad" : "warn"} height={7} />
      </div>
      <p className={cn("mt-3 line-clamp-1 text-[13.5px]", link.latest?.fingerprint_drift ? "font-semibold text-warn" : "text-ink-3")} title={link.latest?.fingerprint}>
        {link.latest ? `${ellipsoidShape(link.latest.rates)} · ${link.latest.fingerprint}` : "no verifications yet"}
      </p>
    </button>
  );
}

function ForecastStrip() {
  const f = useQuery({ queryKey: ["forecast"], queryFn: api.forecast, refetchInterval: 10_000, retry: false });
  const openCopilot = useUi((s) => s.openCopilot);
  if (f.error || !f.data) return null;
  const risky = f.data.links.filter((l) => l.risk === "high" || l.risk === "elevated");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet/25 bg-violet/8 px-4 py-3 text-[14.5px]">
      <BrainCircuit size={18} className="text-violet" />
      <span className="font-semibold text-ink">AI forecast (advisory):</span>
      {risky.length ? risky.map((l) => (
        <span key={l.link} className="text-ink-2"><b className="data">{l.link}</b> risk {l.risk}{l.steps_to_breach ? ` · ~${l.steps_to_breach} verifications to a threshold` : " · past a threshold"}</span>
      )) : <span className="text-ink-2">no link is projected to cross a threshold in the next {f.data.horizon} verifications.</span>}
      <button className="link ml-auto" onClick={() => openCopilot("Forecast the links and tell me what to watch.")}>Ask Sentinel →</button>
    </div>
  );
}

export default function MissionControl() {
  const nav = useNavigate();
  const ov = useOverview();
  const links = useLinks(40);
  const attacks = useAttacks();
  const disputed = useDisputedKeys();
  const events = useTelemetry((s) => s.events);
  const feed = verdictEvents(events).slice(-60).reverse();
  const incident = feed.find((e) => Date.now() / 1000 - e.ts < INCIDENT_WINDOW && classOfEvent(e.data, disputed).tone !== "ok");
  const cls = incident ? classOfEvent(incident.data, disputed) : null;
  const o = ov.data;
  const linkEntries = Object.entries(links.data ?? {});
  const linkStates = linkEntries.map(([, l]) => l.status);
  const bell = linkEntries.find(([, l]) => l.latest?.chsh != null)?.[1];
  const net = linkEntries.map(([name, l]) => {
    const [from, to_] = name.split("->");
    return { name, from, to: to_, status: l.status };
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operate · live" title="Mission" accent="Control"
        lede="Is everything safe right now? Six closed-form detectors judge every signature; this floor shows what they are saying. Every number links to a certificate or a ledger entry." />
      {ov.error && <ErrorNote error={ov.error} hint="Start the backend: uvicorn qsentinel.api.main:app --reload" />}

      <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
        <Reveal>
          <section className="card relative overflow-hidden">
            <div className="absolute left-5 top-5 z-10 max-w-[70%]">
              <div className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-ink-2">
                <Network size={15} className="text-brand" /> Quantum network · {linkEntries.length || 0} link{linkEntries.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="absolute bottom-4 left-5 z-10 flex flex-wrap gap-2 text-[12.5px]">
              {[["healthy", "bg-brand-2"], ["warning", "bg-warn"], ["critical", "bg-bad"]].map(([l, c]) => (
                <span key={l} className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-ink-2"><span className={cn("h-2 w-2 rounded-full", c)} />{l}</span>
              ))}
              <span className="glass rounded-full px-2.5 py-1 text-ink-3">drag to orbit · click a link</span>
            </div>
            <Suspense fallback={<Skeleton className="h-[460px] rounded-none" />}>
              <QuantumNetwork links={net} height={460} onPick={(name) => nav(to("channels"), { state: { link: name } })} />
            </Suspense>
          </section>
        </Reveal>

        <div className="flex min-w-0 flex-col gap-6">
          <Reveal delay={0.08}>
            {incident && cls ? (
              <Card glow tone={cls.tone === "bad" ? "bad" : "warn"} className="h-full">
                <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.14em] text-bad">
                  <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-bad" /><span className="relative h-2.5 w-2.5 rounded-full bg-bad" /></span>
                  Incident in progress
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <AttackIcon glyph={glyphForClass(cls.label)} size={60} tone={cls.tone === "bad" ? "bad" : "warn"} />
                  <div className="min-w-0">
                    <div className="data text-[13px] text-ink-3">Attack class · ledger #{incident.data.ledger_index}</div>
                    <motion.h2 key={incident.seq} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={cn("text-[30px] font-extrabold leading-tight", cls.tone === "bad" ? "text-bad" : "text-warn")}>{cls.label}</motion.h2>
                  </div>
                </div>
                <p className="mt-4 line-clamp-4 text-[15px] leading-relaxed text-ink-2">
                  {incident.data.alerts.filter((a) => a.alert && a.severity !== "info").map((a) => `${a.detector}: ${a.detail}`).join(" · ") || "Flagged by the fixed attribution rules."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
                  {incident.data.alerts.filter((a) => a.alert && a.severity !== "info").map((a) => <DetectorChip key={a.detector} id={a.detector} severity={a.severity} />)}
                  <span className="text-ink-3">{ago(incident.ts)} · {incident.data.link}</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to={to(`verdicts/${incident.data.ledger_index}`)} className="btn-primary btn-sm">Open proof</Link>
                  <button className="btn-ghost btn-sm" onClick={() => useUi.getState().openCopilot(`Explain #${incident.data.ledger_index} and what I should do.`)}>Ask Sentinel</button>
                </div>
              </Card>
            ) : (
              <Card glow className="h-full">
                <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[.14em] text-ok"><ShieldCheck size={16} /> Situation</div>
                <h2 className="mt-4 text-[34px] font-extrabold leading-tight text-ink">All channels <span className="font-serif font-normal italic text-gradient">nominal.</span></h2>
                <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">No alarms in the last three minutes. Entanglement holds above the classical limit and error rates sit inside the frozen baseline.</p>
                {o && <div className="mt-4 flex flex-wrap gap-2"><ClassChip cls={{ label: `${o.verdicts.accept} accepted`, tone: "ok" }} /><Chip tone="neutral">{o.ledger.entries} ledger entries</Chip></div>}
              </Card>
            )}
          </Reveal>
          <Reveal delay={0.14}>
            <Card title="Bell meter" sub="D3 · latest CHSH on any link" icon={Radio}>
              <div className="flex justify-center"><ChshGauge S={bell?.latest?.chsh ?? 0} size={300} /></div>
            </Card>
          </Reveal>
        </div>
      </div>

      <ForecastStrip />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Verdicts" value={o?.verdicts.total} icon={Gavel} sub={o && `${o.verdicts.accept} accepted · ${o.verdicts.reject} rejected`} />
        <Stat label="Critical" value={o?.alerts.critical} icon={AlertOctagon} tone={o?.alerts.critical ? "bad" : "ok"} sub="critical alerts" />
        <Stat label="Warnings" value={o?.alerts.warning} icon={TriangleAlert} tone={o?.alerts.warning ? "warn" : "ok"} sub="soft signals" />
        <Stat label="Links" value={linkStates.length} icon={Activity} tone={linkStates.includes("critical") ? "bad" : linkStates.includes("warning") ? "warn" : "ok"}
          sub={`${linkStates.filter((s) => s === "healthy").length} healthy · ${linkStates.filter((s) => s === "critical").length} critical`} />
        <Stat label="Ledger" value={o ? (o.ledger.chain_ok ? "Valid" : "BROKEN") : undefined} icon={Blocks} tone={o ? (o.ledger.chain_ok ? "ok" : "bad") : undefined} sub={o && `${o.ledger.entries} entries · ${o.ledger.anchors} anchors`} />
        <Stat label="Disputes" value={o?.disputes} icon={Gavel} tone={o?.disputes ? "bad" : "ok"} sub="transferability" />
      </div>

      <QuickActions />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card title="Link health" sub="GET /links · click a card for forensics" icon={Activity}
          actions={<Link to={to("channels")} className="link text-[14px]">Channels →</Link>}>
          {links.error ? <ErrorNote error={links.error} /> : linkEntries.length ? (
            <div className="grid gap-4 lg:grid-cols-2">{linkEntries.map(([n, l]) => <LinkCard key={n} name={n} link={l} />)}</div>
          ) : <Empty>No link commissioned yet. Press “Honest signature” above.</Empty>}
        </Card>
        <Card title="Live feed" sub="WebSocket · /ws/telemetry" icon={Radio}><AlertFeed events={feed} disputed={disputed} maxHeight={560} /></Card>
      </div>

      <Card title="Field guide" sub="which detector catches which attack" icon={ShieldCheck} actions={cls && cls.tone !== "ok" && <ClassChip cls={cls} />}>
        {attacks.data ? <SignatureMatrix attacks={attacks.data} classLabel={cls?.label} fired={new Set(incident?.data.alerts.filter((a) => a.alert && a.severity !== "info").map((a) => a.detector) ?? [])} />
          : attacks.error ? <ErrorNote error={attacks.error} /> : <Skeleton className="h-64" />}
      </Card>
    </div>
  );
}
