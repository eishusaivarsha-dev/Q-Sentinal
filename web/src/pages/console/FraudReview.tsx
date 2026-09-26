// Fraud Review: the advisory AI reads every verification, flags what looks like fraud and says
// why; the analyst decides. The decision is signed onto the kernel's ledger (POST /reviews/{i})
// with the AI's recommendation next to it, so the audit trail shows who decided what - and the
// verdict itself (ACCEPT / REJECT) is never touched: that stays the detectors' call.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck, BrainCircuit, CheckCircle2, Eye, FileSignature, Gavel, ListChecks, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert, UserCheck, XCircle,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { useFraudQueue } from "@/api/hooks";
import type { Disposition, FraudCase, RiskLevel } from "@/api/types";
import { cn } from "@/lib/cn";
import { ago, docket, pct, shortHash } from "@/lib/format";
import { useSession } from "@/state/session";
import { useUi } from "@/state/ui";
import { Reveal } from "@/fx/motion";
import { to } from "@/components/shell/nav";
import { Card, Chip, DecisionBadge, DetectorChip, Empty, ErrorNote, PageHeader, Skeleton, Stat, Tabs, type Tone } from "@/components/ui";

const RiskOrb = lazy(() => import("@/three/RiskOrb"));

const LEVEL_TONE: Record<RiskLevel, Tone> = { critical: "bad", high: "warn", medium: "info", low: "neutral" };

export const DISPOSITION: Record<Disposition, { label: string; icon: LucideIcon; tone: Tone; blurb: string }> = {
  confirm_fraud: { label: "Confirm fraud", icon: XCircle, tone: "bad", blurb: "Treat as a real attack: contain it and keep the evidence." },
  escalate: { label: "Escalate", icon: TriangleAlert, tone: "warn", blurb: "Hand to incident response or the key custodian for a second look." },
  monitor: { label: "Monitor", icon: Eye, tone: "info", blurb: "No action now, but watch this signer or link closely." },
  dismiss: { label: "Dismiss", icon: CheckCircle2, tone: "ok", blurb: "Consistent with honest traffic or a known red-team run." },
};
const ORDER: Disposition[] = ["confirm_fraud", "escalate", "monitor", "dismiss"];

function RiskRing({ risk, level, size = 52 }: { risk: number; level: RiskLevel; size?: number }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const token = { critical: "bad", high: "warn", medium: "violet", low: "brand-2" }[level];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-label={`risk ${risk} of 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line))" strokeWidth={5} />
      <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`rgb(var(--${token}))`} strokeWidth={5} strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - risk / 100) }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="data" fontSize={size * 0.3} fontWeight={700} fill="rgb(var(--ink))">{risk}</text>
    </svg>
  );
}

function QueueItem({ c, active, onPick }: { c: FraudCase; active: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} aria-pressed={active}
      className={cn("flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-300",
        active ? "border-brand/50 bg-brand/8 shadow-[0_14px_30px_-20px_rgb(var(--brand))]" : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/30")}>
      <RiskRing risk={c.risk} level={c.level} size={48} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="data text-[12px] text-ink-3">#{c.ledger_index}</span>
          <span className="truncate text-[15px] font-bold text-ink">{c.category}</span>
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-3">{c.signer_id} → {c.verifier_id} · {ago(c.ts)}</span>
      </span>
      {c.review ? <Chip tone={DISPOSITION[c.review.decision].tone} className="!text-[12px]"><UserCheck size={12} />{DISPOSITION[c.review.decision].label}</Chip>
        : <Chip tone={LEVEL_TONE[c.level]} dot className="!text-[12px]">open</Chip>}
    </button>
  );
}

function DecisionPanel({ c }: { c: FraudCase }) {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const [choice, setChoice] = useState<Disposition | null>(null);
  const [note, setNote] = useState("");
  const [reviewer, setReviewer] = useState(() => {
    try { return localStorage.getItem("qs-reviewer") || "analyst"; } catch { return "analyst"; }
  });
  const [ack, setAck] = useState(false);
  const [revise, setRevise] = useState(false);
  useEffect(() => { setChoice(null); setNote(""); setAck(false); setRevise(false); }, [c.ledger_index]);
  const save = useMutation({
    mutationFn: () => api.review(c.ledger_index, {
      decision: choice as Disposition, note, reviewer,
      advisory: { risk: c.risk, level: c.level, category: c.category, recommendation: c.recommendation },
    }),
    onSuccess: () => {
      try { localStorage.setItem("qs-reviewer", reviewer); } catch { /* storage blocked */ }
      setRevise(false);
      qc.invalidateQueries({ queryKey: ["fraud-queue"] });
      qc.invalidateQueries({ queryKey: ["fraud-case", c.ledger_index] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
    },
  });
  const done = c.review && !revise;

  if (done && c.review) {
    const d = DISPOSITION[c.review.decision];
    return (
      <Card glow title="Your decision is on the ledger" sub={`ledger entry #${c.review.index} · ML-DSA signed`} icon={FileSignature}>
        <div className="flex flex-wrap items-center gap-3">
          <Chip tone={d.tone} className="!text-[15px] !px-3.5 !py-1"><d.icon size={16} />{d.label}</Chip>
          <span className="text-[14px] text-ink-3">by <b className="text-ink">{c.review.reviewer}</b> · {ago(c.review.timestamp)}</span>
          {c.review.agreed_with_ai !== null && (
            <Chip tone={c.review.agreed_with_ai ? "ok" : "brand"}>{c.review.agreed_with_ai ? "agreed with the AI" : "overrode the AI's suggestion"}</Chip>
          )}
        </div>
        {c.review.note && <p className="mt-4 rounded-2xl border border-line bg-surface-2 p-4 text-[15px] italic text-ink-2">“{c.review.note}”</p>}
        <p className="data mt-4 break-all text-[12.5px] text-ink-3">entry hash {shortHash(c.review.entry_hash, 16)}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="btn-ghost btn-sm" to={to("ledger")}>See it on the ledger</Link>
          <button className="btn-ghost btn-sm" disabled={replay} onClick={() => setRevise(true)}>Revise (adds a new entry)</button>
        </div>
      </Card>
    );
  }

  return (
    <Card glow title="Your decision" sub="the AI only suggests · you decide · signed onto the ledger" icon={Gavel}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {ORDER.map((k) => {
          const d = DISPOSITION[k];
          const selected = choice === k;
          const suggested = c.recommendation === k;
          return (
            <button key={k} onClick={() => setChoice(k)} aria-pressed={selected}
              className={cn("relative flex items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300",
                selected ? "border-brand/60 bg-brand/8 shadow-[0_14px_30px_-20px_rgb(var(--brand))]" : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/30")}>
              <d.icon size={20} className={cn("mt-0.5 shrink-0", { bad: "text-bad", warn: "text-warn", info: "text-brand-2", ok: "text-ok", brand: "text-brand", neutral: "text-ink" }[d.tone])} />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 text-[15px] font-bold text-ink">{d.label}
                  {suggested && <span className="inline-flex items-center gap-1 rounded-full bg-violet/12 px-2 py-0.5 text-[11.5px] font-bold text-violet"><Sparkles size={11} />AI suggests</span>}
                </span>
                <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-3">{d.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
      <label className="mt-5 block">
        <span className="text-[14px] font-semibold text-ink-2">Note for the audit trail (optional)</span>
        <textarea className="field mt-2 min-h-[84px]" maxLength={600} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="What you checked, who you contacted, why you agree or disagree with the AI…" />
      </label>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-[14px] font-semibold text-ink-2">Reviewer</span>
          <input className="field mt-2" value={reviewer} maxLength={40} onChange={(e) => setReviewer(e.target.value)} />
        </label>
        <label className="flex cursor-pointer items-center gap-2.5 pb-2.5 text-[14px] text-ink-2">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--brand))]" />
          I reviewed the evidence myself
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="max-w-md text-[13.5px] text-ink-3">The verdict ({c.decision}) stays as the detectors issued it. Your decision is recorded next to it, with the AI's advice, and cannot be silently changed.</p>
        <div className="flex gap-2">
          {revise && <button className="btn-ghost" onClick={() => setRevise(false)}>Cancel</button>}
          <motion.button whileTap={{ scale: 0.96 }} className="btn-primary" disabled={!choice || !ack || !reviewer.trim() || save.isPending || replay} onClick={() => save.mutate()}>
            <FileSignature size={17} />{save.isPending ? "Signing…" : "Sign decision"}
          </motion.button>
        </div>
      </div>
      {save.error && <div className="mt-4"><ErrorNote error={save.error} /></div>}
    </Card>
  );
}

function CaseDetail({ idx }: { idx: number }) {
  const q = useQuery({ queryKey: ["fraud-case", idx], queryFn: () => api.fraudCase(idx), retry: false, refetchInterval: 8000 });
  const openCopilot = useUi((s) => s.openCopilot);
  if (q.error) return <ErrorNote error={q.error} />;
  const c = q.data;
  if (!c) return <div className="space-y-5"><Skeleton className="h-72" /><Skeleton className="h-64" /></div>;
  return (
    <div className="min-w-0 space-y-6">
      <section className="card overflow-hidden">
        <div className="grid md:grid-cols-[1fr_300px]">
          <div className="min-w-0 p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone="neutral" className="data">{docket(c.ledger_index)}</Chip>
              <Chip tone={LEVEL_TONE[c.level]} dot>{c.level} risk</Chip>
              <DecisionBadge decision={c.decision} />
              <Chip tone="info" className="data">{c.link}</Chip>
            </div>
            <h2 className="mt-4 text-[32px] font-extrabold leading-tight text-ink">{c.category}</h2>
            <p className="mt-1 text-[15px] text-ink-3">signer <b className="text-ink">{c.signer_id}</b> · verifier <b className="text-ink">{c.verifier_id}</b> · key <span className="data">{shortHash(c.key_id, 6)}</span> · {ago(c.ts)}</p>
            <div className="mt-5 flex items-center gap-4">
              <RiskRing risk={c.risk} level={c.level} size={76} />
              <div className="min-w-0">
                <div className="label !text-[12px]">AI fraud risk · confidence {c.confidence}</div>
                <p className="text-[15px] text-ink-2">{c.recommendation_text}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {c.detectors.map((d) => <DetectorChip key={d} id={d} severity="critical" />)}
              <Link to={to(`verdicts/${c.ledger_index}`)} className="btn-ghost btn-sm">Open proof certificate</Link>
              <button className="btn-soft btn-sm" onClick={() => openCopilot(`Assess #${c.ledger_index} for fraud. Explain your recommendation and what I should check before deciding.`)}>
                <Sparkles size={15} />Ask Sentinel
              </button>
            </div>
          </div>
          <div className="relative border-t border-line bg-surface-2/60 md:border-l md:border-t-0">
            <Suspense fallback={<Skeleton className="h-[300px] rounded-none" />}>
              <RiskOrb risk={c.risk} reasons={c.reasons.length} decided={Boolean(c.review)} height={300} />
            </Suspense>
            <span className="glass absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-[12px] text-ink-3">turbulence = risk · shards = reasons</span>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Why the AI flagged it" sub="every reason traces to a detector or the ledger" icon={BrainCircuit}>
          <ol className="space-y-3">
            {c.reasons.map((r, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="flex gap-3 text-[15px] leading-snug text-ink-2">
                <span className="data mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet/12 text-[12px] font-bold text-violet">{i + 1}</span>{r}
              </motion.li>
            ))}
          </ol>
          <p className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11.5px] uppercase tracking-wider text-ink-3"><ShieldCheck size={13} />{c.label}</p>
        </Card>
        <Card title="Suggested containment" sub="options, not orders" icon={ListChecks}>
          {c.containment.length ? (
            <ul className="space-y-2.5">
              {c.containment.map((s) => <li key={s} className="flex gap-2.5 text-[15px] text-ink-2"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />{s}</li>)}
            </ul>
          ) : <Empty icon={BadgeCheck}>Nothing to contain: no fraud indicators on this verification.</Empty>}
        </Card>
      </div>

      <DecisionPanel c={c} />
    </div>
  );
}

export default function FraudReview() {
  const { idx } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState<"open" | "all">("open");
  const q = useFraudQueue(25, tab === "open");
  const all = useFraudQueue(25, false);
  const selected = idx !== undefined ? Number(idx) : q.data?.cases[0]?.ledger_index;
  const agreement = all.data?.agreement;

  return (
    <div>
      <PageHeader eyebrow="Assist · human in the loop" title="Fraud" accent="Review"
        lede="The AI reads every verification, flags what looks like fraud and explains why. You make the call: your decision is signed onto the ledger next to the AI's advice, so the audit trail always shows who decided what."
        right={<Tabs value={tab} onChange={setTab} options={[["open", "Needs decision"], ["all", "All flagged"]]} />} />

      {q.error && <div className="mb-6"><ErrorNote error={q.error} hint="Start the advisory service: uvicorn qsentinel_ops.server:app --port 8100" /></div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Scanned" value={all.data?.scanned} icon={Eye} sub="verifications read by the AI" />
        <Stat label="Flagged" value={all.data?.flagged} icon={ShieldAlert} tone={all.data?.by_level.critical ? "bad" : all.data?.flagged ? "warn" : "ok"}
          sub={all.data && `${all.data.by_level.critical} critical · ${all.data.by_level.high} high · ${all.data.by_level.medium} medium`} />
        <Stat label="Awaiting you" value={all.data?.open} icon={Gavel} tone={all.data?.open ? "warn" : "ok"} sub="open cases" />
        <Stat label="You agreed with AI" value={agreement === null || agreement === undefined ? "–" : pct(agreement, 0)} icon={UserCheck}
          sub="share of your decisions matching its suggestion" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Reveal>
          <Card title="Queue" sub={q.data ? `${q.data.cases.length} case${q.data.cases.length === 1 ? "" : "s"} · highest risk first` : "loading"} icon={ListChecks} bodyClass="!pt-3">
            {!q.data && !q.error && <div className="space-y-2.5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[74px]" />)}</div>}
            {q.data && q.data.cases.length === 0 && (
              <Empty icon={ShieldCheck}>{tab === "open" ? "Nothing waiting for your decision." : "Nothing flagged yet."} Launch an attack in the <Link className="link" to={to("attacks")}>Attack Lab</Link> to see the queue fill.</Empty>
            )}
            <div className="-mr-2 max-h-[720px] space-y-2.5 overflow-y-auto pr-2" data-lenis-prevent>
              <AnimatePresence initial={false}>
                {q.data?.cases.map((c) => (
                  <motion.div key={c.ledger_index} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <QueueItem c={c} active={selected === c.ledger_index} onPick={() => nav(to(`fraud/${c.ledger_index}`))} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Card>
        </Reveal>
        {selected !== undefined && !Number.isNaN(selected) ? <CaseDetail key={selected} idx={selected} /> : (
          <Card title="How this works" icon={BrainCircuit}>
            <ol className="grid gap-4 md:grid-cols-3">
              {[["Physics decides the verdict", "Six closed-form detectors accept or reject each signature. No AI is involved."],
                ["The AI looks for fraud", "It combines detector alerts, ledger disputes, anomaly scores and signer history into a risk score with reasons."],
                ["You decide what to do", "Confirm, escalate, monitor or dismiss. Your decision is signed onto the ledger with the AI's advice beside it."]].map(([t, b], i) => (
                <li key={t} className="rounded-2xl border border-line bg-surface-2 p-4">
                  <div className="data text-[13px] font-bold text-brand">0{i + 1}</div>
                  <div className="mt-1 text-[16px] font-bold text-ink">{t}</div>
                  <p className="mt-1 text-[14px] text-ink-3">{b}</p>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </div>
  );
}
