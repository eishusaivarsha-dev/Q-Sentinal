// One signature animated through all six layers (docs/frontend-spec.md §4.2).
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { BlockHeatmap } from "../components/VerdictParts";
import { Button, Card, DecisionPill, Empty, ErrorNote, Pill } from "../components/ui";
import { classOfVerdict } from "../lib/attribution";
import { verdictEvents } from "../lib/events";
import { sci } from "../lib/physics";
import { useTelemetry } from "../state/telemetry";

function Stage({ n, active, layer, title, children }: { n: number; active: boolean; layer: string; title: string; children: ReactNode }) {
  return (
    <div className={`min-w-[220px] flex-1 rounded-xl border p-3 transition-all duration-500 ${active ? "border-cyan-500 bg-slate-900 opacity-100" : "border-slate-800 bg-slate-950 opacity-30"}`}>
      <p className="text-xs uppercase tracking-wider text-cyan-400">{n}. {layer}</p>
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 text-sm text-slate-300">{children}</div>
    </div>
  );
}

export default function Journey() {
  const { idx } = useParams();
  const navigate = useNavigate();
  const events = useTelemetry((s) => s.events);
  const recent = verdictEvents(events).slice(-25).reverse();
  const target = idx !== undefined ? Number(idx) : recent[0]?.data.ledger_index;
  const q = useQuery({ queryKey: ["verdict", target], queryFn: () => api.verdict(target as number), enabled: target !== undefined });
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const [step, setStep] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  useEffect(() => {
    setStep(0);
    const t = window.setInterval(() => setStep((s) => (s >= 8 ? s : s + 1)), 550);
    return () => window.clearInterval(t);
  }, [target, q.data?.certificate.ledger_index, replayKey]);

  const v = q.data;
  const r = (d: string) => v?.results.find((x) => x.detector === d);
  const eve = Boolean((r("D3")?.alert && r("D3")?.severity !== "info") || (r("D4")?.alert && r("D4")?.severity !== "info"));
  const d2 = r("D2");
  const cls = v && classOfVerdict(v);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Signature Journey</h1>
          <p className="text-sm text-slate-400">One signature, through every layer: quantum, detection, blockchain, and the advisory AI at arm's length.</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="rounded-lg bg-slate-800 p-2 text-sm" value={target ?? ""} onChange={(e) => navigate(`/journey/${e.target.value}`)}>
            {recent.map((e) => <option key={e.seq} value={e.data.ledger_index}>#{e.data.ledger_index} {e.data.decision} {e.data.link}</option>)}
          </select>
          <Button variant="ghost" onClick={() => setReplayKey((k) => k + 1)}>Replay animation</Button>
        </div>
      </div>
      {target === undefined && <Empty>No verifications yet – run one from Mission Control or the Attack Lab.</Empty>}
      {q.error && <ErrorNote error={q.error} />}
      {v && (
        <>
          <div className="flex gap-3 overflow-x-auto pb-2">
            <Stage n={1} active={step >= 1} layer="L1 protocol" title="One-time key issued">
              <p>Fresh key <span className="font-mono text-xs">{v.certificate.signature.key_id.slice(0, 10)}…</span> for {v.certificate.signature.signer_id}. Used once, then burned.</p>
            </Stage>
            <Stage n={2} active={step >= 2} layer="L0 quantum" title="Teleportation">
              <p>Bell pair → Bell-state measurement → 2 correction bits → Pauli fix at {v.certificate.transcript.verifier_id}.</p>
              {eve ? <p className="mt-2 font-semibold text-orange-300">An eavesdropper disturbed the channel.</p> : <p className="mt-2 text-emerald-300">Channel undisturbed.</p>}
            </Stage>
            <Stage n={3} active={step >= 3} layer="L1 + L3" title="Symmetrisation">
              <p>{health.data?.symmetrise ? "Verifiers committed secret shares on the ledger and shuffled their key copies." : "Symmetrisation is switched off."}</p>
            </Stage>
            <Stage n={4} active={step >= 4} layer="L1 measurement" title={`${v.certificate.transcript.total_rounds.toLocaleString()} coins measured`}>
              {d2 && <BlockHeatmap mismatches={v.certificate.transcript.block_mismatches} limit={d2.threshold ?? 0} failed={d2.extra.failed_blocks ?? []} />}
            </Stage>
            <Stage n={5} active={step >= 5} layer="L2 detection" title="Six alarms">
              <div className="flex flex-wrap gap-2">
                {v.results.map((res, i) => {
                  const on = step >= 5;
                  const tone = res.alert && res.severity !== "info" ? (res.severity === "critical" ? "bg-rose-500" : "bg-amber-400") : "bg-emerald-500";
                  return (
                    <div key={res.detector} className="flex flex-col items-center text-xs">
                      <span className={`h-6 w-6 rounded-full transition-colors duration-300 ${on ? tone : "bg-slate-700"}`} style={{ transitionDelay: `${i * 150}ms` }} />
                      {res.detector}
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-slate-400">SPRT decided after {r("D4")?.extra.sprt_rounds} rounds.</p>
            </Stage>
            <Stage n={6} active={step >= 6} layer="L2 verdict" title="Verdict">
              <div className="flex flex-wrap items-center gap-2"><DecisionPill decision={v.decision} />{cls && <Pill tone={cls.tone}>{cls.label}</Pill>}</div>
              <p className="mt-2 text-xs">Forger passes one block with probability ≤ {sci(v.certificate.forgery_exact_per_block)}</p>
            </Stage>
            <Stage n={7} active={step >= 7} layer="L3 blockchain" title="Written to the ledger">
              <p>Entry #{v.certificate.ledger_index} <span className="font-mono text-xs">{v.certificate.ledger_entry_hash.slice(0, 12)}…</span>, signed with ML-DSA-65.</p>
              <p className="mt-1 text-xs">Merkle: {v.certificate.merkle_proof === "pending" ? "pending (next anchor)" : "anchored ✓"}</p>
            </Stage>
            <Stage n={8} active={step >= 8} layer="L5 telemetry" title="One-way to the ops plane">
              <p>A read-only copy goes to the dashboard and the advisory AI. Nothing flows back.</p>
            </Stage>
          </div>
          <Card title="What happened">
            <p className="text-sm text-slate-300">{v.certificate.alerts.length ? v.certificate.alerts.join(" · ") : "No alarms: every check passed."}</p>
            <Link className="mt-2 inline-block text-sm text-cyan-300 underline" to={`/verdicts/${v.certificate.ledger_index}`}>Open the full proof certificate →</Link>
          </Card>
        </>
      )}
    </div>
  );
}
