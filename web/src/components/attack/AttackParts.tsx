import { Link } from "react-router-dom";
import type { AttackInfo, AttackRun } from "@/api/types";
import { attackCopy, classOfVerdict } from "@/lib/attribution";
import { pct } from "@/lib/format";
import { AttackGlyph } from "../art/AttackGlyph";
import { ClassChip, Chip, DecisionBadge, LinkText, Panel } from "../shell/primitives";

/** One drawer card in the attack catalogue (data from GET /attacks). */
export function AttackCard({ a, selected, onPick }: { a: AttackInfo; selected: boolean; onPick: () => void }) {
  const copy = attackCopy(a.name);
  return (
    <button onClick={onPick} aria-pressed={selected}
      className={`group flex min-w-0 items-start gap-3 rounded-[8px] border p-2.5 text-left transition ${selected ? "border-amber bg-amber/[.08] shadow-glow" : "border-amber/10 hover:border-amber/40"}`}>
      <span className={`shrink-0 transition ${selected ? "scale-110" : "group-hover:-rotate-6"}`}><AttackGlyph glyph={copy.glyph} size={42} hot={selected} /></span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2"><span className="data shrink-0 whitespace-nowrap text-[10px] text-paper-faint">{copy.code}</span>
          <span className={`font-label text-[12px] uppercase tracking-[.12em] ${selected ? "text-amber" : "text-paper"}`}>{copy.label}</span></span>
        <span className="block text-[11.5px] leading-snug text-paper-faint">{copy.oneLiner || a.description}</span>
        <span className="mt-1.5 flex flex-wrap gap-1">
          {a.detectors.map((d) => <Chip key={d} tone="info" className="data !tracking-normal">{d}</Chip>)}
          {a.expected === "ACCEPT" && !a.detectors.length && <Chip tone="ok">must accept</Chip>}
          {a.expected === "-" && <Chip tone="warn">warn, not reject</Chip>}
        </span>
      </span>
    </button>
  );
}

function Meter({ label, value, color, note }: { label: string; value: number; color: string; note: string }) {
  const segs = 24;
  const lit = Math.round(Math.min(1, Math.max(0, value)) * segs);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2"><span className="label">{label}</span><span className="data text-[14px]" style={{ color }}>{pct(value, 0)}</span></div>
      <div className="flex gap-[3px] rounded-[4px] border hair bg-ink p-1.5">
        {Array.from({ length: segs }, (_, i) => (
          <span key={i} className="h-4 flex-1 rounded-[1px] transition-all"
            style={{ background: i < lit ? color : "#221d15", boxShadow: i < lit ? `0 0 6px ${color}` : "none", transitionDelay: `${i * 18}ms` }} />
        ))}
      </div>
      <div className="mt-1 text-[11px] text-paper-faint">{note}</div>
    </div>
  );
}

/** Information vs disturbance, from AttackRun.metrics (spec §4.3). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InfoMeter({ metrics }: { metrics: Record<string, any> }) {
  if (metrics.eve_accuracy_with_bits === undefined) return null;
  return (
    <div className="space-y-4">
      <Meter label="Eve's accuracy if correction bits are public" value={metrics.eve_accuracy_with_bits} color="#ffc15e" note="She reads the 2 classical correction bits too." />
      <Meter label="…if correction bits are encrypted (post-quantum tunnel)" value={metrics.eve_accuracy_without_bits} color="#7fb8a4" note="≈ 50% = coin flip, zero information." />
      <Meter label="Damage she caused" value={metrics.disturbance} color="#e0513a" note="Errors on the qubits she touched → alarms fire." />
      <p className="font-type text-[11.5px] text-paper-faint">Teleportation is a quantum one-time pad; encrypting 2 bits per qubit leaves Eve with nothing but a trail.</p>
    </div>
  );
}

/** Result card for POST /attacks/run. PASS/FAIL, decision and fired detectors come from the backend. */
export function RunResult({ run }: { run: AttackRun }) {
  const cls = classOfVerdict(run.verdict);
  const copy = attackCopy(run.attack);
  const idx = run.verdict.certificate.ledger_index;
  return (
    <Panel title={`${copy.label} @ ${pct(run.strength, 0)}`} code={`ledger #${idx}`}
      actions={<><Chip tone={run.result === "PASS" ? "ok" : "bad"}>{run.result === "PASS" ? "caught as expected" : "not as expected"}</Chip><DecisionBadge decision={run.decision} /></>}>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <ClassChip cls={cls} />
        <span className="text-paper-faint">fired <b className="data text-paper">{run.fired || "none"}</b> · expected <span className="data">{run.expected || "none"}</span></span>
      </div>
      <p className="mt-2 text-[12.5px] text-paper-dim">{run.detail}</p>
      {run.metrics.bob && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-paper-dim">Bob (direct) <DecisionBadge decision={run.metrics.bob} /> · Charlie (forwarded) <DecisionBadge decision={run.metrics.charlie} /></p>
      )}
      {run.metrics.eve_accuracy_with_bits !== undefined && <div className="mt-4"><InfoMeter metrics={run.metrics} /></div>}
      <Link className="mt-4 inline-block" to={`/verdicts/${idx}`}><LinkText>Open proof certificate #{idx} →</LinkText></Link>
    </Panel>
  );
}
