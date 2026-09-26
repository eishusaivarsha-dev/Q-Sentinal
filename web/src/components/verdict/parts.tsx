// Pieces of the proof certificate (docs/frontend-spec.md §4.4 and §7) and the attack-run result.
import { motion } from "framer-motion";
import { CheckCircle2, Download, Fingerprint, Printer, QrCode, ShieldAlert, XCircle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { absoluteApi } from "@/api/client";
import type { AttackInfo, AttackRun, DetectorResult, Fingerprint as Fp, MerkleProof, Verdict } from "@/api/types";
import { attackCopy, classOfVerdict, DETECTORS, glyphForClass, type AttackClass, type DetectorId } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { docket, pct, sci, shortHash, stamp } from "@/lib/format";
import { walkProof } from "@/lib/merkle";
import { downloadJson } from "@/state/session";
import { themeColor } from "@/state/ui";
import { TiltCard } from "@/fx/motion";
import { to } from "../shell/nav";
import { AiBadge, AttackIcon, Card, Chip, ClassChip, DecisionBadge, KeyVal, Meter } from "../ui";

/** Big verdict banner with an animated seal. Decision text and colour come straight from verdict.decision. */
export function VerdictBanner({ v, cls }: { v: Verdict; cls: AttackClass }) {
  const c = v.certificate;
  const reject = v.decision === "REJECT";
  return (
    <section className={cn("card overflow-hidden", reject ? "!border-bad/30" : "!border-ok/30")}>
      <div className="absolute inset-0 opacity-70" style={{ background: `radial-gradient(60% 120% at 100% 0%, rgb(var(--${reject ? "bad" : "ok"}) / .12), transparent 60%)` }} />
      <div className="relative grid gap-8 p-7 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Chip tone="neutral" className="data">{docket(c.ledger_index)}</Chip>
            <ClassChip cls={cls} />
            <Chip tone="info" className="data">{c.link}</Chip>
            {c.protocol.transferred && <Chip tone="brand">forwarded · τ {c.protocol.tau_applied}</Chip>}
          </div>
          <h2 className="text-[34px] font-extrabold leading-tight text-ink md:text-[42px]">{reject ? "Signature rejected" : "Signature verified"}</h2>
          <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-2">
            A forger passes one block with probability <b className="data text-brand">{sci(c.forgery_exact_per_block)}</b> (exact) ≤{" "}
            <span className="data">{sci(c.forgery_bound_per_block)}</span> (Chernoff) · τ = {c.protocol.tau_applied} · {c.protocol.basis_set} · L = {c.protocol.hash_bits}, n = {c.protocol.rounds_per_bit}
          </p>
          <div className="mt-5"><KeyVal cols={4} items={[["Signer", c.signature.signer_id], ["Verifier", c.transcript.verifier_id], ["Key", shortHash(c.signature.key_id, 8)], ["Issued", stamp(c.issued_at)]]} /></div>
          {cls.tone !== "ok" && (
            <div className="mt-5 flex items-center gap-4 rounded-2xl border border-bad/25 bg-bad/8 p-4">
              <AttackIcon glyph={glyphForClass(cls.label)} tone="bad" />
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-bad">Attack class: {cls.label}</div>
                <div className="text-[14px] text-ink-2">{c.alerts.length ? c.alerts.join(" · ") : "Detector output translated by the fixed attribution rules."}</div>
              </div>
            </div>
          )}
          <div className="mt-5"><AiBadge /></div>
        </div>
        <Seal reject={reject} index={c.ledger_index} />
      </div>
    </section>
  );
}

function Seal({ reject, index }: { reject: boolean; index: number }) {
  const color = reject ? "bad" : "ok";
  const Icon = reject ? XCircle : CheckCircle2;
  return (
    <motion.div key={index} initial={{ scale: 1.8, rotate: -18, opacity: 0 }} animate={{ scale: 1, rotate: -6, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 16 }} className="mx-auto flex h-[190px] w-[190px] flex-col items-center justify-center rounded-full border-[3px] border-dashed"
      style={{ borderColor: `rgb(var(--${color}) / .6)`, background: `radial-gradient(circle, rgb(var(--${color}) / .14), transparent 70%)` }}>
      <Icon size={52} className={reject ? "text-bad" : "text-ok"} strokeWidth={1.8} />
      <div className={cn("mt-2 text-[22px] font-extrabold tracking-[.14em]", reject ? "text-bad" : "text-ok")}>{reject ? "REJECTED" : "ACCEPTED"}</div>
      <div className="data text-[12px] text-ink-3">LEDGER #{index}</div>
    </motion.div>
  );
}

/** A detector's statistic against its threshold. */
function Bullet({ r }: { r: DetectorResult }) {
  const value = r.statistic as number;
  const thr = r.threshold as number;
  const max = r.detector === "D3" ? 3 : Math.max(thr * 2.5, value, 1e-9);
  const fired = r.alert && r.severity !== "info";
  return (
    <div className="my-3">
      <Meter value={value} max={max} threshold={thr} tone={!fired ? "ok" : r.severity === "critical" ? "bad" : "warn"} />
      <div className="data mt-1.5 flex justify-between text-[12.5px] text-ink-3"><span>statistic {sci(value)}</span><span>threshold {sci(thr)}</span></div>
    </div>
  );
}

export function DetectorCard({ r, children }: { r: DetectorResult; children?: ReactNode }) {
  const info = DETECTORS[r.detector as DetectorId];
  const fired = r.alert && r.severity !== "info";
  const numeric = typeof r.statistic === "number" && typeof r.threshold === "number" && !["D1", "D5"].includes(r.detector);
  const tone = !fired ? "ok" : r.severity === "critical" ? "bad" : "warn";
  return (
    <TiltCard max={4} className="h-full">
      <article className={cn("card h-full p-5", fired && (r.severity === "critical" ? "!border-bad/35" : "!border-warn/35"))}>
        <header className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="data text-[13px] font-semibold text-brand">{r.detector}</div>
            <h3 className="text-[19px] font-bold leading-tight text-ink">{r.name || info?.name}</h3>
          </div>
          <Chip tone={tone} dot>{fired ? r.severity : "passed"}</Chip>
        </header>
        {info && <p className="text-[14.5px] italic leading-snug text-ink-3">{info.law}</p>}
        {numeric && <Bullet r={r} />}
        <p className="mt-2 text-[14.5px] leading-snug text-ink-2">{r.detail}</p>
        {children && <div className="mt-4 min-w-0">{children}</div>}
      </article>
    </TiltCard>
  );
}

export function BlockHeatmap({ mismatches, limit, failed }: { mismatches: number[]; limit: number; failed: number[] }) {
  const cols = Math.ceil(Math.sqrt(mismatches.length));
  const f = new Set(failed);
  return (
    <div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="img" aria-label="Per-block mismatch map">
        {mismatches.map((m, i) => {
          const r = limit > 0 ? m / limit : m > 0 ? 2 : 0;
          const token = r === 0 ? "ok" : r <= 1 ? "warn" : "bad";
          return (
            <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.004 }} title={`digest bit ${i}: ${m} mismatches (limit ${limit})`}
              className="aspect-square rounded-[4px]" style={{ background: `rgb(var(--${token}) / ${r === 0 ? 0.55 : 0.9})`, outline: f.has(i) ? `2px solid rgb(var(--ink))` : undefined }} />
          );
        })}
      </div>
      <p className="mt-2 text-[13px] text-ink-3">One square per digest bit: green = no mismatches, amber = within the limit of {limit}, red = over it (outlined = failed block).</p>
    </div>
  );
}

export function FingerprintPanel({ fp }: { fp: Fp }) {
  const bases = ["Z", "X", "Y"] as const;
  const token = { Z: "brand", X: "violet", Y: "ok" } as const;
  const max = Math.max(0.05, ...bases.map((b) => fp.rates[b]), ...bases.map((b) => fp.baseline_rates?.[b] ?? 0));
  return (
    <div className="space-y-2.5">
      <p className={cn("text-[15px] font-semibold leading-snug", fp.drift ? "text-warn" : "text-ok")}><Fingerprint size={15} className="mr-1.5 inline" />{fp.label}</p>
      {bases.map((b) => (
        <div key={b} className="flex items-center gap-3 text-[13px]">
          <span className="w-16 font-semibold text-ink-3">{b}-basis</span>
          <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-line/70">
            {fp.baseline_rates && <div className="absolute h-3 rounded-full bg-ink-3/30" style={{ width: `${(fp.baseline_rates[b] / max) * 100}%` }} />}
            <motion.div className="relative h-3 rounded-full" initial={{ width: 0 }} animate={{ width: `${(fp.rates[b] / max) * 100}%` }} style={{ background: `rgb(var(--${token[b]}))` }} />
          </div>
          <span className="data w-16 text-right text-ink">{pct(fp.rates[b])}</span>
        </div>
      ))}
      <p className="text-[13px] text-ink-3">
        Grey = frozen baseline{Number.isFinite(fp.p_value) && <> · G-test p = <span className="data">{sci(fp.p_value)}</span></>}
        {fp.est_intercept_fraction !== null && <> · estimated intercepted fraction ≈ <b className="text-ink">{pct(fp.est_intercept_fraction)}</b></>}
      </p>
    </div>
  );
}

export function BsmBars({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(...counts, 1);
  return (
    <div>
      <div className="flex h-24 items-end gap-3" aria-label="Bell-state-measurement outcome counts">
        {counts.map((c, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${["00", "01", "10", "11"][i]}: ${c} (${((c / total) * 100).toFixed(1)}%)`}>
            <motion.div className="w-full rounded-t-lg" initial={{ height: 0 }} animate={{ height: `${(c / max) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08 }}
              style={{ background: "linear-gradient(180deg, rgb(var(--brand-2)), rgb(var(--brand)))" }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-3 text-center">{["00", "01", "10", "11"].map((l) => <span key={l} className="data flex-1 text-[13px] text-ink-3">{l}</span>)}</div>
      <p className="mt-1 text-[13px] text-ink-3">Bell-measurement outcomes should be ~25% each.</p>
    </div>
  );
}

/** Audit path as a ladder, recomputed in the browser with SHA3-256 (RFC 6962 prefixes). */
export function MerkleLadder({ proof, serverValid }: { proof: MerkleProof; serverValid?: boolean }) {
  const [checked, setChecked] = useState<boolean | null>(null);
  const steps = walkProof(proof.leaf, proof.proof);
  const agree = checked !== null && serverValid !== undefined ? checked === serverValid : null;
  return (
    <div className="space-y-4">
      <ol className="relative space-y-2 border-l-2 border-dashed border-line-2 pl-5">
        {steps.map((s, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} className="relative">
            <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-brand bg-surface" />
            <div className="data flex flex-wrap items-baseline gap-x-3 text-[13px]">
              <span className="w-14 font-semibold text-ink-3">{i === 0 ? "leaf" : `step ${i}`}</span>
              {s.sibling && <span className="text-violet">{s.side === "L" ? "← " : "→ "}{shortHash(s.sibling, 6)}</span>}
              <span className="text-ink">= {shortHash(s.result, 8)}</span>
            </div>
          </motion.li>
        ))}
      </ol>
      <p className="data text-[13px] text-ink-3">anchored root <span className="font-semibold text-brand">{shortHash(proof.root, 12)}</span> · ledger entry #{proof.anchor_index}</p>
      <div className="flex flex-wrap items-center gap-3">
        {serverValid !== undefined && <Chip tone={serverValid ? "ok" : "bad"}>server says {serverValid ? "VALID" : "INVALID"}</Chip>}
        <button className="btn-primary btn-sm" onClick={() => setChecked(steps[steps.length - 1].result === proof.root)}>Verify in my browser (SHA3-256)</button>
      </div>
      {checked !== null && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex items-center gap-2 text-[15px] font-bold", checked ? "text-ok" : "text-bad")}>
          {checked ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
          Browser: root {checked ? "matches" : "MISMATCH"}{agree !== null && ` · ${agree ? "agrees with the server" : "DISAGREES with the server"}`}
        </motion.div>
      )}
    </div>
  );
}

/** QR (public proof URL, no credentials), JSON certificate download and print. */
export function CertificateExport({ verdict }: { verdict: Verdict }) {
  const idx = verdict.certificate.ledger_index;
  const url = absoluteApi(`/ledger/proof/${idx}`);
  return (
    <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
      <div className="rounded-3xl border border-line bg-white p-4 shadow-card">
        <QRCodeSVG value={url} size={132} bgColor="#ffffff" fgColor="#0a1022" level="M" />
      </div>
      <div className="min-w-0 space-y-3">
        <p className="text-[15px] text-ink-2"><QrCode size={16} className="mr-1.5 inline text-brand" />Scan to fetch the public Merkle proof for ledger entry #{idx}. It contains no credentials.</p>
        <p className="data break-all text-[13px] text-ink-3">{url}</p>
        <div className="no-print flex flex-wrap gap-2">
          <button className="btn-ghost btn-sm" onClick={() => downloadJson(`qsentinel-certificate-${idx}.json`, verdict)}><Download size={15} /> Certificate (JSON)</button>
          <button className="btn-ghost btn-sm" onClick={() => window.print()}><Printer size={15} /> Print / PDF</button>
        </div>
      </div>
    </div>
  );
}

/** A SHA3 hash as a strip of coloured cells (each hex digit = one cell). */
export function HashStrip({ hash }: { hash: string }) {
  const cells = hash.slice(0, 64).split("");
  return (
    <div>
      <div className="grid grid-cols-[repeat(32,minmax(0,1fr))] gap-[2px]" aria-label="Transcript hash">
        {cells.map((c, i) => {
          const v = parseInt(c, 16) / 15;
          return <div key={i} className="aspect-[1/2] rounded-[2px]" style={{ background: `color-mix(in srgb, ${themeColor("brand")} ${Math.round(20 + v * 80)}%, ${themeColor("brand-2")})`, opacity: 0.35 + v * 0.65 }} />;
        })}
      </div>
      <div className="data mt-2 break-all text-[12.5px] leading-relaxed text-ink-3">{hash.match(/.{1,8}/g)?.join(" ")}</div>
    </div>
  );
}

/** One card in the attack catalogue (data from GET /attacks). */
export function AttackCard({ a, selected, onPick }: { a: AttackInfo; selected: boolean; onPick: () => void }) {
  const copy = attackCopy(a.name);
  return (
    <button onClick={onPick} aria-pressed={selected}
      className={cn("group flex w-full min-w-0 items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-300",
        selected ? "border-brand/50 bg-brand/8 shadow-[0_14px_30px_-20px_rgb(var(--brand))]" : "border-line bg-surface hover:-translate-y-0.5 hover:border-brand/30")}>
      <AttackIcon glyph={copy.glyph} size={42} tone={a.name === "honest" ? "ok" : selected ? "brand" : "neutral"} />
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="data shrink-0 text-[12px] text-ink-3">{copy.code}</span>
          <span className={cn("truncate text-[15px] font-bold", selected ? "text-brand" : "text-ink")}>{copy.label}</span>
        </span>
        <span className="mt-0.5 block text-[13.5px] leading-snug text-ink-3">{copy.oneLiner || a.description}</span>
        <span className="mt-2 flex flex-wrap gap-1">
          {a.detectors.map((d) => <Chip key={d} tone="info" className="data !text-[12px]">{d}</Chip>)}
          {a.expected === "ACCEPT" && !a.detectors.length && <Chip tone="ok">must accept</Chip>}
          {a.expected === "-" && <Chip tone="warn">warn, not reject</Chip>}
        </span>
      </span>
    </button>
  );
}

/** Information vs disturbance, from AttackRun.metrics (spec §4.3). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InfoMeter({ metrics }: { metrics: Record<string, any> }) {
  if (metrics.eve_accuracy_with_bits === undefined) return null;
  const rows: [string, number, "warn" | "ok" | "bad", string][] = [
    ["Eve's accuracy if correction bits are public", metrics.eve_accuracy_with_bits, "warn", "She also reads the 2 classical correction bits."],
    ["…if they travel encrypted (post-quantum tunnel)", metrics.eve_accuracy_without_bits, "ok", "≈ 50% = a coin flip: zero information."],
    ["Damage she caused", metrics.disturbance, "bad", "Errors on the qubits she touched → alarms fire."],
  ];
  return (
    <div className="space-y-4">
      {rows.map(([label, v, tone, note]) => (
        <div key={label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-2"><span className="text-[14px] font-semibold text-ink-2">{label}</span><span className={cn("data text-[15px] font-bold", `text-${tone}`)}>{pct(v, 0)}</span></div>
          <Meter value={v} tone={tone} />
          <div className="mt-1 text-[13px] text-ink-3">{note}</div>
        </div>
      ))}
    </div>
  );
}

/** Result card for POST /attacks/run. PASS/FAIL, decision and fired detectors come from the backend. */
export function RunResult({ run }: { run: AttackRun }) {
  const cls = classOfVerdict(run.verdict);
  const copy = attackCopy(run.attack);
  const idx = run.verdict.certificate.ledger_index;
  return (
    <Card glow title={`${copy.label} @ ${pct(run.strength, 0)}`} sub={`ledger #${idx}`} icon={ShieldAlert}
      actions={<><Chip tone={run.result === "PASS" ? "ok" : "bad"}>{run.result === "PASS" ? "caught as expected" : "not as expected"}</Chip><DecisionBadge decision={run.decision} /></>}>
      <div className="flex flex-wrap items-center gap-2 text-[14px]">
        <ClassChip cls={cls} />
        <span className="text-ink-3">fired <b className="data text-ink">{run.fired || "none"}</b> · expected <span className="data">{run.expected || "none"}</span></span>
      </div>
      <p className="mt-3 text-[15px] text-ink-2">{run.detail}</p>
      {run.metrics.bob && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-ink-2">Bob (direct) <DecisionBadge decision={run.metrics.bob} /> · Charlie (forwarded) <DecisionBadge decision={run.metrics.charlie} /></p>
      )}
      {run.metrics.eve_accuracy_with_bits !== undefined && <div className="mt-5"><InfoMeter metrics={run.metrics} /></div>}
      <Link className="link mt-5 inline-block text-[15px]" to={to(`verdicts/${idx}`)}>Open proof certificate #{idx} →</Link>
    </Card>
  );
}
