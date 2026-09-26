// One signature animated through all six layers (docs/frontend-spec.md §4.2).
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHealth, useVerdict, useVerdictSummaries } from "@/api/hooks";
import type { Verdict } from "@/api/types";
import { classOfVerdict } from "@/lib/attribution";
import { docket, sci, shortHash } from "@/lib/format";
import { CipherWheel } from "@/components/art/CipherWheel";
import { EnigmaQuantum } from "@/components/art/EnigmaQuantum";
import { Lamp, Stamp } from "@/components/art/Instruments";
import { ClassChip, DecisionBadge, Empty, ErrorNote, LinkText, PageHeader, Panel } from "@/components/shell/primitives";
import { BlockHeatmap } from "@/components/verdict/VerdictParts";

const STAGES = [
  { key: "key", layer: "L1", title: "Key issued", body: "A fresh one-time key is forged for the signer. It will be used once, then burned." },
  { key: "teleport", layer: "L0", title: "Teleportation", body: "Bell pair → Bell-state measurement → 2 correction bits → Pauli fix {I, X, Z, XZ} at the verifier." },
  { key: "sym", layer: "L1 + L3", title: "Symmetrisation", body: "With several verifiers, each posts a commitment on the chain, then they shuffle their key copies — so nobody can be singled out." },
  { key: "measure", layer: "L1", title: "Measurement", body: "The verifier measures every coin in the revealed basis. Each square is one digest bit, coloured by its mismatch count." },
  { key: "detect", layer: "L2", title: "Six detectors", body: "Six closed-form laws are checked in turn. Any violation lights its lamp; SPRT reports how quickly it decided." },
  { key: "verdict", layer: "L2", title: "Verdict", body: "The decision, its attack class and the forger's exact odds of passing one block." },
  { key: "ledger", layer: "L3", title: "Ledger", body: "The verdict is chained, signed with ML-DSA-65 and later anchored under a Merkle root." },
  { key: "ops", layer: "L5", title: "One-way to ops", body: "A read-only copy flows to the dashboard and the advisory AI through a one-way valve. Nothing flows back." },
] as const;

function Bench({ stage, v, symmetrise }: { stage: (typeof STAGES)[number]["key"]; v: Verdict; symmetrise?: boolean }) {
  const c = v.certificate;
  const r = (d: string) => v.results.find((x) => x.detector === d);
  const eve = [r("D3"), r("D4")].some((x) => x?.alert && x.severity !== "info");
  switch (stage) {
    case "key":
      return (
        <div className="flex flex-col items-center gap-4">
          <CipherWheel size={140} />
          <div className="plate-dark data">key {shortHash(c.signature.key_id, 10)} · {c.signature.signer_id}</div>
          <div className="label">🔒 one-time key · counter {c.signature.counter}</div>
        </div>
      );
    case "teleport":
      return (
        <div className="text-center">
          <EnigmaQuantum className="mx-auto w-full max-w-[460px]" alarm={eve} />
          <p className={`mt-3 font-label text-[12px] uppercase tracking-[.16em] ${eve ? "text-reject" : "text-accept"}`}>
            {eve ? "⚠ An eavesdropper disturbed the channel (D3 / D4)" : "Channel undisturbed"}
          </p>
        </div>
      );
    case "sym":
      return (
        <div className="text-center">
          <div className="font-display text-[34px] text-paper">{symmetrise ? "Commit → reveal → shuffle" : "Symmetrisation off"}</div>
          <p className="mt-2 text-[12.5px] text-paper-dim">{symmetrise ? "Verifiers committed secret shares on the ledger and shuffled their key copies." : "The backend runs with symmetrisation disabled."}</p>
        </div>
      );
    case "measure":
      return (
        <div>
          <p className="mb-3 text-center text-[12px] text-paper-faint">{c.transcript.total_rounds.toLocaleString()} coins · {c.protocol.hash_bits} blocks × {c.protocol.rounds_per_bit} rounds</p>
          {r("D2") && <BlockHeatmap mismatches={c.transcript.block_mismatches} limit={r("D2")!.threshold ?? 0} failed={r("D2")!.extra.failed_blocks ?? []} />}
        </div>
      );
    case "detect":
      return (
        <div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {v.results.map((res, i) => {
              const fired = res.alert && res.severity !== "info";
              const color = !fired ? "#a9c46c" : res.severity === "critical" ? "#e0513a" : "#ffc15e";
              return (
                <motion.div key={res.detector} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.15 }}
                  className="flex flex-col items-center gap-1 rounded-md border hair p-2" title={res.detail}>
                  <Lamp on color={color} size={22} pulse={fired} />
                  <span className="data text-[11px]">{res.detector}</span>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[11.5px] text-paper-faint">SPRT decided after {r("D4")?.extra.sprt_rounds ?? "–"} rounds.</p>
        </div>
      );
    case "verdict":
      return (
        <div className="flex flex-col items-center gap-3">
          <Stamp text={v.decision === "ACCEPT" ? "ACCEPTED" : "REJECTED"} color={v.decision === "ACCEPT" ? "#a9c46c" : "#e0513a"} sub={docket(c.ledger_index)} />
          <ClassChip cls={classOfVerdict(v)} />
          <p className="text-[12px] text-paper-dim">Forger passes one block with probability ≤ <b className="data text-amber">{sci(c.forgery_exact_per_block)}</b></p>
        </div>
      );
    case "ledger":
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="rounded-sm border-2 border-ink px-6 py-4 font-type text-[13px] text-ink shadow-[6px_6px_0_#0c0a07]" style={{ background: "#e9dcc0", transform: "rotate(-1.5deg)" }}>
            <div className="text-[11px]">LEDGER ENTRY #{c.ledger_index}</div>
            <div className="mt-1 break-all">{shortHash(c.ledger_entry_hash, 12)}</div>
            <div className="mt-2 text-[11px]">MERKLE: {c.merkle_proof === "pending" ? "PENDING (NEXT ANCHOR)" : "ANCHORED ✓"}</div>
          </div>
          <Link to={`/verdicts/${c.ledger_index}`}><LinkText>Verify its Merkle proof →</LinkText></Link>
        </div>
      );
    default:
      return (
        <div className="text-center">
          <div className="font-display text-[30px] text-paper">Trust kernel ⟶ <span className="text-verdigris">Ops plane</span></div>
          <p className="mt-2 text-[12.5px] text-paper-dim">One-way valve: telemetry only. The advisory AI can read, never write.</p>
        </div>
      );
  }
}

export default function Journey() {
  const { idx } = useParams();
  const navigate = useNavigate();
  const recent = useVerdictSummaries(25);
  const health = useHealth();
  const target = idx !== undefined ? Number(idx) : recent.data?.[0]?.ledger_index;
  const q = useVerdict(target);
  const [step, setStep] = useState(0);
  const [auto, setAuto] = useState(true);

  // Replay the animation whenever a new verdict is shown.
  useEffect(() => { setStep(0); setAuto(true); }, [target]);
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => (step < STAGES.length - 1 ? setStep(step + 1) : setAuto(false)), 2600);
    return () => window.clearTimeout(t);
  }, [auto, step]);

  const v = q.data;
  const stage = STAGES[step];

  return (
    <div>
      <PageHeader directive="Directive 02 · Procedure manual" title="Signature Journey"
        lede="One signature through every layer: quantum, detection, blockchain, and the advisory AI kept at arm's length."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select className="field !w-auto max-w-[280px]" value={target ?? ""} onChange={(e) => navigate(`/journey/${e.target.value}`)} aria-label="Choose verdict">
              {recent.data?.map((s) => <option key={s.ledger_index} value={s.ledger_index}>{docket(s.ledger_index)} · {s.decision} · {s.link}</option>)}
            </select>
            <button className="btn-ghost" onClick={() => { setStep(0); setAuto(true); }}>↻ Replay</button>
          </div>
        } />
      {target === undefined && !recent.isLoading && <Empty>No verifications yet — run one from Mission Control or the Attack Lab.</Empty>}
      {q.error && <ErrorNote error={q.error} />}
      {v && (
        <>
          <Panel className="mb-5" bodyClass="p-4 md:p-6">
            <div className="relative">
              <div className="absolute left-[6%] right-[6%] top-[30px] h-[10px] rounded-full border-2 border-ink" style={{ background: "linear-gradient(180deg,#6b4a22,#3a2614)" }} />
              <motion.div className="absolute top-[22px] h-[26px] w-[26px] rounded-full" style={{ background: "radial-gradient(circle,#fff,#ffc15e 40%,transparent 70%)" }}
                animate={{ left: `calc(${6 + (step / (STAGES.length - 1)) * 88}% - 13px)` }} transition={{ type: "spring", stiffness: 60, damping: 12 }} />
              <ol className="relative grid grid-cols-8">
                {STAGES.map((s, i) => (
                  <li key={s.key} className="flex flex-col items-center text-center">
                    <button onClick={() => { setStep(i); setAuto(false); }} aria-current={i === step} aria-label={s.title}
                      className={`relative z-10 flex h-[66px] w-[66px] max-w-full items-center justify-center rounded-full border-[3px] border-ink transition ${i <= step ? "scale-100" : "scale-90 opacity-60"}`}
                      style={{ background: i === step ? "radial-gradient(circle at 35% 30%, #f3c877, #c98a2e 60%, #7a4d17)" : "#1b150d", boxShadow: i === step ? "0 0 30px -4px rgba(255,193,94,.7)" : "inset 0 0 0 2px #3a2a16" }}>
                      <span className={`font-display text-[22px] ${i === step ? "text-ink" : "text-paper-faint"}`}>{i + 1}</span>
                    </button>
                    <span className={`mt-2 hidden font-label text-[10px] uppercase tracking-[.12em] md:block ${i === step ? "text-amber" : "text-paper-faint"}`}>{s.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Panel>
          <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
            <Panel title={`Station ${step + 1} · ${stage.title}`} code={`${stage.layer} · ${docket(v.certificate.ledger_index)}`} actions={<DecisionBadge decision={v.decision} />}>
              <AnimatePresence mode="wait">
                <motion.p key={stage.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="font-display text-[22px] leading-snug text-paper">
                  {stage.body}
                </motion.p>
              </AnimatePresence>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <button className="btn-ghost" onClick={() => { setAuto(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}>← Back</button>
                <button className="btn-primary" onClick={() => { setAuto(false); setStep(Math.min(STAGES.length - 1, step + 1)); }} disabled={step === STAGES.length - 1}>Next station →</button>
                <button className="btn-ghost" onClick={() => { if (step === STAGES.length - 1) setStep(0); setAuto(!auto); }}>{auto ? "❚❚ Pause" : "▶ Autoplay"}</button>
              </div>
              <p className="mt-4 line-clamp-3 text-[12px] text-paper-faint" title={v.certificate.alerts.join("\n")}>{v.certificate.alerts.length ? v.certificate.alerts.join(" · ") : "No alarms: every check passed."}</p>
            </Panel>
            <Panel title="Bench view" code={v.certificate.link} bodyClass="p-6 min-h-[320px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div key={stage.key} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <Bench stage={stage.key} v={v} symmetrise={health.data?.symmetrise} />
                </motion.div>
              </AnimatePresence>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
