// The analyst's 60-second screen (docs/frontend-spec.md §4.1).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useAttacks, useDisputedKeys, useLinks, useOverview } from "@/api/hooks";
import type { LinkStatus } from "@/api/types";
import { attackCopy, classOfEvent, glyphForClass } from "@/lib/attribution";
import { verdictEvents } from "@/lib/events";
import { ago, pct } from "@/lib/format";
import { baselineRates, ellipsoidShape } from "@/lib/physics";
import { useSession } from "@/state/session";
import { useTelemetry } from "@/state/telemetry";
import { AttackGlyph } from "@/components/art/AttackGlyph";
import { EnigmaQuantum } from "@/components/art/EnigmaQuantum";
import { Oscilloscope, VacuumTube } from "@/components/art/Instruments";
import EllipseThumb from "@/components/channel/EllipseThumb";
import { Sparkline } from "@/components/channel/SeriesChart";
import { Chip, ClassChip, DetectorChip, Empty, ErrorNote, LinkText, PageHeader, Panel, Stat } from "@/components/shell/primitives";
import { AlertFeed } from "@/components/verdict/AlertFeed";
import { ChshGauge } from "@/components/verdict/ChshGauge";
import { SignatureMatrix } from "@/components/verdict/SignatureMatrix";

const QUICK: [string, number | null][] = [
  ["honest", null], ["blind_forgery", null], ["intercept_resend", 0.5], ["stealth_probe", null], ["replay", null], ["stolen_key_honeypot", null],
];
const INCIDENT_WINDOW = 180;

function QuickLevers() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const run = useMutation({
    mutationFn: ({ attack, strength }: { attack: string; strength: number | null }) => api.runAttack({ attack, strength }),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <Panel title="Quick demo levers" code="POST /attacks/run"
      actions={run.isPending ? <Chip tone="info">transmitting…</Chip> : run.data && <Chip tone={run.data.result === "PASS" ? "ok" : "bad"}>{attackCopy(run.data.attack).label}: {run.data.decision}</Chip>}>
      <div className="flex flex-wrap gap-2">
        {QUICK.map(([attack, strength]) => (
          <button key={attack} className={attack === "honest" ? "btn-primary" : "btn-danger"} disabled={run.isPending || replay}
            onClick={() => run.mutate({ attack, strength })}>
            {attackCopy(attack).label}{strength !== null ? ` ${pct(strength, 0)}` : ""}
          </button>
        ))}
      </div>
      {run.error && <div className="mt-3"><ErrorNote error={run.error} /></div>}
      {replay && <p className="mt-2 text-[11.5px] text-paper-faint">Replay mode: levers are disabled; browse the recorded session.</p>}
    </Panel>
  );
}

function LinkCard({ name, link }: { name: string; link: LinkStatus }) {
  const tone = link.status === "critical" ? "bad" : link.status === "warning" ? "warn" : link.status === "healthy" ? "ok" : "neutral";
  const cusumShare = Math.min(1, (link.latest?.cusum ?? 0) / 0.03);
  const base = baselineRates(link);
  return (
    <div className="min-w-0 overflow-hidden rounded-md border hair bg-ink/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="data truncate text-[13px] text-paper">{name}</p>
        <Chip tone={tone}>{link.status}</Chip>
      </div>
      <div className="mt-2 flex gap-3">
        <EllipseThumb rates={link.latest?.rates ?? null} baseline={base} alarm={link.status === "critical"} />
        <div className="min-w-0 flex-1 space-y-1 text-[11px]">
          <p className="text-paper-faint">QBER <b className="data text-paper">{pct(link.latest?.qber)}</b> <span className="text-paper-mute">(normal {pct(link.baseline.qber)}, alarm 11%)</span></p>
          <Sparkline values={link.history.map((h) => h.qber)} threshold={0.11} baseline={link.baseline.qber} />
          <p className="text-paper-faint">CHSH <b className="data text-paper">{link.latest?.chsh?.toFixed(3) ?? "–"}</b> · checks {link.verifications} · CUSUM alarms {link.cusum_alarms}</p>
          <div className="h-1.5 rounded bg-ink-700" title={`CUSUM ${(link.latest?.cusum ?? 0).toFixed(3)} / 0.03`}>
            <div className={`h-1.5 rounded ${cusumShare >= 1 ? "bg-reject" : "bg-amber"}`} style={{ width: `${cusumShare * 100}%` }} />
          </div>
        </div>
      </div>
      <p className={`mt-2 truncate text-[11px] ${link.latest?.fingerprint_drift ? "text-amber-hot" : "text-paper-faint"}`} title={link.latest?.fingerprint}>
        {link.latest ? `${ellipsoidShape(link.latest.rates)} · ${link.latest.fingerprint}` : "no verifications yet"}
      </p>
    </div>
  );
}

export default function MissionControl() {
  const ov = useOverview();
  const links = useLinks(40);
  const attacks = useAttacks();
  const disputed = useDisputedKeys();
  const events = useTelemetry((s) => s.events);
  const feed = verdictEvents(events).slice(-40).reverse();
  const incident = feed.find((e) => Date.now() / 1000 - e.ts < INCIDENT_WINDOW && classOfEvent(e.data, disputed).tone !== "ok");
  const cls = incident ? classOfEvent(incident.data, disputed) : null;
  const o = ov.data;
  const linkStates = Object.values(o?.links ?? {});
  const linkEntries = Object.entries(links.data ?? {});
  const bell = linkEntries.find(([, l]) => l.latest?.chsh != null)?.[1];

  return (
    <div>
      <PageHeader directive="Directive 01 · Watch floor" title="Mission Control"
        lede="Is everything OK right now? Six closed-form detectors judge every signature; this floor shows what they are saying. Every number links to a certificate or ledger entry." />
      {ov.error && <div className="mb-5"><ErrorNote error={ov.error} hint="Start the backend: uvicorn qsentinel.api.main:app --reload" /></div>}

      <section className={`panel mb-5 overflow-hidden ${incident?.data.decision === "REJECT" ? "!bg-[#1a0d09]/90" : ""}`}
        style={incident ? { boxShadow: `inset 0 0 0 1px ${cls?.tone === "bad" ? "rgba(224,81,58,.5)" : "rgba(240,165,58,.5)"}, 0 0 80px -30px rgba(224,81,58,.7)` } : undefined}>
        <div className="grid items-center gap-4 p-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="min-w-0">
            <div className={`eyebrow mb-3 ${incident ? "!text-reject" : ""}`}>{incident ? "● Incident in progress" : "○ Situation"}</div>
            {incident && cls ? (
              <>
                <div className="flex items-center gap-4">
                  <AttackGlyph glyph={glyphForClass(cls.label)} size={76} hot />
                  <div className="min-w-0">
                    <div className="data text-[12px] text-paper-faint">Attack class · ledger #{incident.data.ledger_index}</div>
                    <h2 className={`font-display text-[32px] leading-none md:text-[44px] ${cls.tone === "bad" ? "text-reject" : "text-amber-hot"}`}>{cls.label}</h2>
                  </div>
                </div>
                <p className="mt-4 line-clamp-4 max-w-xl text-[13px] leading-relaxed text-paper" title={incident.data.alerts.map((a) => `${a.detector}: ${a.detail}`).join("\n")}>
                  {incident.data.alerts.map((a) => `${a.detector}: ${a.detail}`).join(" · ") || "Detector output flagged by the fixed attribution rules."}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-paper-faint">Fired:</span>
                  {incident.data.alerts.map((a) => <DetectorChip key={a.detector} id={a.detector} severity={a.severity} />)}
                  <span className="text-paper-faint">· {ago(incident.ts)} · {incident.data.link}</span>
                  <Link to={`/verdicts/${incident.data.ledger_index}`} className="ml-1"><LinkText>Open proof →</LinkText></Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="font-display text-[40px] leading-none text-paper md:text-[52px]">All channels <em className="text-amber">nominal.</em></h2>
                <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-paper-dim">No alarms in the last three minutes. Entanglement holds above the classical limit and error rates sit within the frozen baseline.</p>
              </>
            )}
          </div>
          <EnigmaQuantum className="mx-auto w-full max-w-[520px]" alarm={cls?.tone === "bad"} />
        </div>
      </section>

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Verdicts" value={o?.verdicts.total ?? "–"} sub={o && `${o.verdicts.accept} accepted · ${o.verdicts.reject} rejected`} />
        <Stat label="Critical alerts" value={o?.alerts.critical ?? "–"} tone={o?.alerts.critical ? "bad" : "ok"} />
        <Stat label="Warnings" value={o?.alerts.warning ?? "–"} tone={o?.alerts.warning ? "warn" : "ok"} />
        <Stat label="Links" value={linkStates.length || "–"} tone={linkStates.includes("critical") ? "bad" : linkStates.includes("warning") ? "warn" : "ok"}
          sub={`${linkStates.filter((s) => s === "healthy").length} healthy · ${linkStates.filter((s) => s === "warning").length} warn · ${linkStates.filter((s) => s === "critical").length} critical`} />
        <Stat label="Ledger" value={o ? (o.ledger.chain_ok ? "valid ✓" : "BROKEN") : "–"} tone={o ? (o.ledger.chain_ok ? "ok" : "bad") : undefined}
          sub={o && `${o.ledger.entries} entries · ${o.ledger.anchors} anchors`} />
        <Stat label="Disputes" value={o?.disputes ?? "–"} tone={o?.disputes ? "bad" : "ok"} sub="transferability violations" />
      </div>

      <div className="mb-5"><QuickLevers /></div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="Link health" code="GET /links" actions={<Link to="/channels"><LinkText>Observatory →</LinkText></Link>}>
          {links.error ? <ErrorNote error={links.error} /> : linkEntries.length ? (
            <div className="grid gap-3 lg:grid-cols-2">{linkEntries.map(([n, l]) => <LinkCard key={n} name={n} link={l} />)}</div>
          ) : <Empty>No link commissioned yet. Pull the “Honest signature” lever above.</Empty>}
        </Panel>
        <Panel title="Bell meter" code="D3 · latest">
          <div className="flex items-center justify-center gap-4">
            <VacuumTube level={bell?.latest?.chsh ? Math.min(1, Math.max(0.15, (bell.latest.chsh - 1.4) / 1.4)) : 0.2} width={38} className="hidden sm:block" />
            <ChshGauge S={bell?.latest?.chsh ?? 0} size={280} />
            <VacuumTube level={bell?.latest ? Math.min(1, bell.latest.qber * 8) : 0.2} width={38} className="hidden sm:block" />
          </div>
          <div className="mt-2 flex justify-center">
            <Oscilloscope values={(bell?.history ?? []).map((h) => ((h.chsh ?? 0) - 1.4) / 1.6)} width={220} height={130} label="S · TRACE" />
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        <Panel title="Field guide" code="attack signatures" actions={cls && cls.tone !== "ok" && <ClassChip cls={cls} />}>
          {attacks.data ? (
            <SignatureMatrix attacks={attacks.data} classLabel={cls?.label} fired={new Set(incident?.data.alerts.map((a) => a.detector) ?? [])} />
          ) : attacks.error ? <ErrorNote error={attacks.error} /> : <Empty>Loading the catalogue…</Empty>}
        </Panel>
        <Panel title="Teleprinter" code="live WebSocket feed"><AlertFeed events={feed} disputed={disputed} /></Panel>
      </div>
    </div>
  );
}
