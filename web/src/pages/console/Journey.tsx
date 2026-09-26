// Signature Journey (docs/frontend-spec.md §4.2): one real signature animated through all six
// layers, on a 3-D stage, with the evidence for each station beside it. Also the place to sign and
// check your own message end to end.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, KeyRound, Pause, Play, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { useHealth, useVerdict, useVerdictSummaries } from "@/api/hooks";
import type { Verdict } from "@/api/types";
import { classOfVerdict } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { docket, sci, shortHash } from "@/lib/format";
import { useSession } from "@/state/session";
import { to } from "@/components/shell/nav";
import { AiBadge, Card, Chip, ClassChip, DecisionBadge, Empty, ErrorNote, PageHeader, Skeleton } from "@/components/ui";
import { BlockHeatmap, HashStrip } from "@/components/verdict/parts";

const StoryScene = lazy(() => import("@/three/StoryScene"));

const STAGES = [
  { key: "key", layer: "L1", scene: 0, title: "Key issued", body: "A fresh one-time key is forged for the signer. It will be used once, then burned." },
  { key: "teleport", layer: "L0", scene: 1, title: "Teleportation", body: "Bell pair → Bell-state measurement → 2 correction bits → Pauli fix {I, X, Z, XZ} at the verifier." },
  { key: "sym", layer: "L1 + L3", scene: 2, title: "Symmetrisation", body: "With several verifiers, each posts a commitment on the chain, then they shuffle key copies, so nobody can be singled out." },
  { key: "measure", layer: "L1", scene: 3, title: "Measurement", body: "The verifier measures every coin in the revealed basis. Each square is one digest bit, coloured by its mismatch count." },
  { key: "detect", layer: "L2", scene: 4, title: "Six detectors", body: "Six closed-form laws are checked in turn. Any violation lights its lamp; SPRT reports how quickly it decided." },
  { key: "verdict", layer: "L2", scene: 4.4, title: "Verdict", body: "The decision, its attack class and the forger's exact odds of passing one block." },
  { key: "ledger", layer: "L3", scene: 5, title: "Ledger", body: "The verdict is chained, signed with ML-DSA-65 and later anchored under a Merkle root." },
  { key: "ops", layer: "L5", scene: 5, title: "One-way to the AI", body: "A read-only copy flows to the advisory AI, which may flag fraud for a human to decide. Nothing flows back into the verdict." },
] as const;

function Bench({ stage, v, symmetrise }: { stage: (typeof STAGES)[number]["key"]; v: Verdict; symmetrise?: boolean }) {
  const c = v.certificate;
  const r = (d: string) => v.results.find((x) => x.detector === d);
  const eve = [r("D3"), r("D4")].some((x) => x?.alert && x.severity !== "info");
  switch (stage) {
    case "key":
      return (
        <div className="space-y-3 text-center">
          <KeyRound size={46} className="mx-auto text-brand" />
          <div className="data text-[15px] text-ink">key {shortHash(c.signature.key_id, 10)}</div>
          <div className="text-[14px] text-ink-3">signer {c.signature.signer_id} · counter {c.signature.counter} · nonce {shortHash(c.signature.nonce, 6)}</div>
        </div>
      );
    case "teleport":
      return (
        <div className="text-center">
          <div className={cn("text-[26px] font-extrabold", eve ? "text-bad" : "text-ok")}>{eve ? "Channel disturbed" : "Channel undisturbed"}</div>
          <p className="mt-2 text-[15px] text-ink-2">{eve ? "D3 / D4 saw an eavesdropper's fingerprints on the Bell pairs." : "Entanglement arrived intact; the correction bits did the rest."}</p>
          <p className="data mt-3 text-[13px] text-ink-3">{c.channel_fingerprint}</p>
        </div>
      );
    case "sym":
      return (
        <div className="text-center">
          <div className="text-[26px] font-extrabold text-ink">{symmetrise ? "Commit → reveal → shuffle" : "Symmetrisation off"}</div>
          <p className="mt-2 text-[15px] text-ink-2">{symmetrise ? "Verifiers committed secret shares on the ledger and shuffled their key copies." : "The backend runs with symmetrisation disabled."}</p>
        </div>
      );
    case "measure":
      return (
        <div>
          <p className="mb-3 text-center text-[14px] text-ink-3">{c.transcript.total_rounds.toLocaleString()} coins · {c.protocol.hash_bits} blocks × {c.protocol.rounds_per_bit} rounds</p>
          {r("D2") && <BlockHeatmap mismatches={c.transcript.block_mismatches} limit={r("D2")!.threshold ?? 0} failed={r("D2")!.extra.failed_blocks ?? []} />}
        </div>
      );
    case "detect":
      return (
        <div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {v.results.map((res, i) => {
              const fired = res.alert && res.severity !== "info";
              const tone = !fired ? "ok" : res.severity === "critical" ? "bad" : "warn";
              return (
                <motion.div key={res.detector} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12 }}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface p-3" title={res.detail}>
                  <span className={cn("h-5 w-5 rounded-full", `bg-${tone}`, fired && "animate-pulse")} style={{ boxShadow: `0 0 18px rgb(var(--${tone}) / .6)` }} />
                  <span className="data text-[13px] font-semibold text-ink">{res.detector}</span>
                </motion.div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-[13px] text-ink-3">SPRT decided after {r("D4")?.extra.sprt_rounds ?? "–"} rounds.</p>
        </div>
      );
    case "verdict":
      return (
        <div className="flex flex-col items-center gap-3 text-center">
          <DecisionBadge decision={v.decision} size="lg" />
          <ClassChip cls={classOfVerdict(v)} />
          <p className="text-[15px] text-ink-2">A forger passes one block with probability ≤ <b className="data text-brand">{sci(c.forgery_exact_per_block)}</b></p>
        </div>
      );
    case "ledger":
      return (
        <div className="space-y-3">
          <div className="text-center text-[15px] text-ink-2">Ledger entry <b className="data">#{c.ledger_index}</b> · Merkle {c.merkle_proof === "pending" ? <Chip tone="warn">pending next anchor</Chip> : <Chip tone="ok">anchored</Chip>}</div>
          <HashStrip hash={c.ledger_entry_hash} />
          <div className="text-center"><Link className="link" to={to(`verdicts/${c.ledger_index}`)}>Verify its Merkle proof →</Link></div>
        </div>
      );
    default:
      return (
        <div className="space-y-4 text-center">
          <div className="text-[24px] font-extrabold text-ink">Trust kernel ⟶ <span className="text-gradient">advisory AI</span></div>
          <p className="text-[15px] text-ink-2">One-way valve: telemetry only. The AI can flag fraud and advise; the analyst decides.</p>
          <div className="flex flex-wrap justify-center gap-2"><AiBadge /><Link className="btn-soft btn-sm" to={to(`fraud/${c.ledger_index}`)}>Fraud check for this signature</Link></div>
        </div>
      );
  }
}

function SignYourOwn() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const [msg, setMsg] = useState("Approve purchase order PO-2291 for ₹4,80,000");
  const [verifier, setVerifier] = useState("bob");
  const run = useMutation({
    mutationFn: async () => api.verify(await api.sign(msg, "alice"), verifier),
    onSuccess: (v) => { qc.invalidateQueries(); nav(to(`journey/${v.certificate.ledger_index}`)); },
  });
  return (
    <Card title="Sign and check your own message" sub="alice signs · the verifier checks · the journey below replays it" icon={Send} className="mb-6">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <input className="field" value={msg} maxLength={200} onChange={(e) => setMsg(e.target.value)} aria-label="Message to sign" />
        <select className="field md:!w-auto" value={verifier} onChange={(e) => setVerifier(e.target.value)} aria-label="Verifier">
          <option value="bob">verifier: bob</option><option value="charlie">verifier: charlie</option>
        </select>
        <button className="btn-primary" disabled={!msg.trim() || run.isPending || replay} onClick={() => run.mutate()}><ShieldCheck size={16} />{run.isPending ? "Verifying…" : "Sign & verify"}</button>
      </div>
      {run.error && <div className="mt-3"><ErrorNote error={run.error} /></div>}
    </Card>
  );
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

  useEffect(() => { setStep(0); setAuto(true); }, [target]);
  useEffect(() => {
    if (!auto) return;
    const t = window.setTimeout(() => (step < STAGES.length - 1 ? setStep(step + 1) : setAuto(false)), 2800);
    return () => window.clearTimeout(t);
  }, [auto, step]);

  const v = q.data;
  const stage = STAGES[step];
  const eve = Boolean(v?.results.some((x) => ["D3", "D4"].includes(x.detector) && x.alert && x.severity !== "info"));

  return (
    <div>
      <PageHeader eyebrow="Prove · walkthrough" title="Signature" accent="Journey"
        lede="One real signature through every layer: quantum, detection, blockchain, and the advisory AI kept at arm's length."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <select className="field !w-auto max-w-[300px]" value={target ?? ""} onChange={(e) => navigate(to(`journey/${e.target.value}`))} aria-label="Choose verdict">
              {recent.data?.map((s) => <option key={s.ledger_index} value={s.ledger_index}>{docket(s.ledger_index)} · {s.decision} · {s.link}</option>)}
            </select>
            <button className="btn-ghost" onClick={() => { setStep(0); setAuto(true); }}><RotateCcw size={16} />Replay</button>
          </div>
        } />
      <SignYourOwn />
      {target === undefined && !recent.isLoading && <Empty>No verifications yet. Sign a message above.</Empty>}
      {q.error && <ErrorNote error={q.error} />}
      {target !== undefined && !v && !q.error && <Skeleton className="h-[520px]" />}
      {v && (
        <>
          <div className="card mb-6 p-5">
            <div className="relative">
              <div className="absolute left-[6%] right-[6%] top-[21px] h-[3px] rounded-full bg-line" />
              <motion.div className="absolute left-[6%] top-[21px] h-[3px] rounded-full" style={{ background: "linear-gradient(90deg, rgb(var(--brand)), rgb(var(--brand-2)))" }}
                animate={{ width: `${(step / (STAGES.length - 1)) * 88}%` }} transition={{ type: "spring", stiffness: 60, damping: 14 }} />
              <ol className="relative grid grid-cols-8">
                {STAGES.map((s, i) => (
                  <li key={s.key} className="flex flex-col items-center text-center">
                    <button onClick={() => { setStep(i); setAuto(false); }} aria-current={i === step} aria-label={s.title}
                      className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 font-mono text-[15px] font-bold transition-all",
                        i === step ? "scale-110 border-brand bg-brand text-white shadow-glow" : i < step ? "border-brand bg-surface text-brand" : "border-line-2 bg-surface text-ink-3")}>{i + 1}</button>
                    <span className={cn("mt-2 hidden text-[12.5px] font-semibold md:block", i === step ? "text-brand" : "text-ink-3")}>{s.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <section className="card relative overflow-hidden">
              <div className="absolute left-5 top-5 z-10 flex flex-wrap gap-2">
                <Chip tone="neutral" className="data">{stage.layer}</Chip><DecisionBadge decision={v.decision} />
              </div>
              <Suspense fallback={<Skeleton className="h-[440px] rounded-none" />}>
                <StoryScene stage={stage.scene} height={440} eve={eve} />
              </Suspense>
            </section>
            <div className="min-w-0 space-y-6">
              <Card title={`Station ${step + 1} · ${stage.title}`} sub={docket(v.certificate.ledger_index)}>
                <AnimatePresence mode="wait">
                  <motion.p key={stage.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-[19px] font-semibold leading-snug text-ink">{stage.body}</motion.p>
                </AnimatePresence>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button className="btn-ghost btn-sm" onClick={() => { setAuto(false); setStep(Math.max(0, step - 1)); }} disabled={step === 0}><ChevronLeft size={15} />Back</button>
                  <button className="btn-primary btn-sm" onClick={() => { setAuto(false); setStep(Math.min(STAGES.length - 1, step + 1)); }} disabled={step === STAGES.length - 1}>Next<ChevronRight size={15} /></button>
                  <button className="btn-ghost btn-sm" onClick={() => { if (step === STAGES.length - 1) setStep(0); setAuto(!auto); }}>{auto ? <><Pause size={15} />Pause</> : <><Play size={15} />Autoplay</>}</button>
                </div>
              </Card>
              <Card title="Bench view" sub={v.certificate.link} bodyClass="min-h-[260px] flex flex-col justify-center">
                <AnimatePresence mode="wait">
                  <motion.div key={stage.key} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                    <Bench stage={stage.key} v={v} symmetrise={health.data?.symmetrise} />
                  </motion.div>
                </AnimatePresence>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
