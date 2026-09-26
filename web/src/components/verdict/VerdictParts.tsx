// Pieces of the proof certificate (docs/frontend-spec.md §4.4 and §7), in the Bureau's style.
import { QRCodeSVG } from "qrcode.react";
import { useState, type ReactNode } from "react";
import { API_URL } from "@/api/client";
import type { DetectorResult, Fingerprint, MerkleProof, Verdict } from "@/api/types";
import { DETECTORS, glyphForClass, type AttackClass, type DetectorId } from "@/lib/attribution";
import { docket, pct, sci, shortHash, stamp } from "@/lib/format";
import { walkProof } from "@/lib/merkle";
import { downloadJson } from "@/state/session";
import { AttackGlyph } from "../art/AttackGlyph";
import { Lamp, Stamp } from "../art/Instruments";
import { AiBadge, Chip, ClassChip } from "../shell/primitives";

/** Big case-file banner. Decision text and colour come straight from verdict.decision. */
export function VerdictBanner({ v, cls }: { v: Verdict; cls: AttackClass }) {
  const c = v.certificate;
  const reject = v.decision === "REJECT";
  return (
    <div className={`panel overflow-hidden ${reject ? "!bg-[#1a0d09]/90" : ""}`}
      style={reject ? { boxShadow: "inset 0 0 0 1px rgba(224,81,58,.5), 0 0 60px -20px rgba(224,81,58,.6)" } : undefined}>
      <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="plate-dark data">{docket(c.ledger_index)}</span>
            <ClassChip cls={cls} />
            <span className="data text-[12px] text-paper-dim">{c.link}</span>
            {c.protocol.transferred && <Chip tone="info">forwarded · τ {c.protocol.tau_applied}</Chip>}
          </div>
          <h2 className="font-display text-[28px] leading-tight text-paper md:text-[36px]">
            {reject ? "Signature rejected" : "Signature verified"}
          </h2>
          <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-paper-dim">
            A forger passes one block with probability <b className="data text-amber">{sci(c.forgery_exact_per_block)}</b> (exact)
            {" "}≤ <span className="data">{sci(c.forgery_bound_per_block)}</span> (Chernoff) · τ = {c.protocol.tau_applied} · {c.protocol.basis_set} ·
            L = {c.protocol.hash_bits}, n = {c.protocol.rounds_per_bit}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] sm:grid-cols-4">
            {[["Signer", c.signature.signer_id], ["Verifier", c.transcript.verifier_id], ["Key", shortHash(c.signature.key_id, 8)], ["Issued", stamp(c.issued_at)]].map(([k, val]) => (
              <div key={k} className="min-w-0"><dt className="label">{k}</dt><dd className="data truncate text-paper">{val}</dd></div>
            ))}
          </dl>
          {cls.tone !== "ok" && (
            <div className="mt-4 flex items-center gap-3 rounded-md border border-rust/40 bg-rust/10 p-3">
              <AttackGlyph glyph={glyphForClass(cls.label)} size={44} hot />
              <div className="min-w-0 text-[12px]">
                <div className="font-label uppercase tracking-[.16em] text-[#ffb08f]">Attack class: {cls.label}</div>
                <div className="text-paper-dim">{c.alerts.length ? c.alerts.join(" · ") : "Detector output translated by the fixed §8 rules."}</div>
              </div>
            </div>
          )}
          <div className="mt-4"><AiBadge value={c.ai_in_trust_path} /></div>
        </div>
        <div className="flex justify-center md:w-[260px]">
          <Stamp key={c.ledger_index} text={reject ? "REJECTED" : "ACCEPTED"} color={reject ? "#e0513a" : "#a9c46c"} sub={`LEDGER #${c.ledger_index}`} />
        </div>
      </div>
    </div>
  );
}

/** A statistic against its threshold. D3 is "lower is bad"; D1 and D5 have no meaningful bar. */
function Bullet({ r }: { r: DetectorResult }) {
  const value = r.statistic as number;
  const thr = r.threshold as number;
  const max = r.detector === "D3" ? 3 : Math.max(thr * 2.5, value, 1e-9);
  const w = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;
  const fired = r.alert && r.severity !== "info";
  return (
    <>
      <div className="relative mb-1 mt-1 h-2 rounded-full bg-ink-700">
        <div className={`h-full rounded-full ${fired ? (r.severity === "critical" ? "bg-reject" : "bg-amber") : "bg-accept/80"}`} style={{ width: w(value) }} />
        <div className="absolute -top-1 h-4 w-[2px] bg-paper" style={{ left: w(thr) }} title="threshold" />
      </div>
      <div className="mb-2 flex justify-between text-[10.5px] text-paper-faint"><span className="data">statistic {sci(value)}</span><span className="data">threshold {sci(thr)}</span></div>
    </>
  );
}

export function DetectorCard({ r, children }: { r: DetectorResult; children?: ReactNode }) {
  const info = DETECTORS[r.detector as DetectorId];
  const fired = r.alert && r.severity !== "info";
  const numeric = typeof r.statistic === "number" && typeof r.threshold === "number" && !["D1", "D5"].includes(r.detector);
  const color = !fired ? "#a9c46c" : r.severity === "critical" ? "#e0513a" : "#ffc15e";
  return (
    <article className={`panel flex min-w-0 flex-col p-4 pt-5 ${fired ? "!bg-[#1a0d09]/90" : ""}`}
      style={fired ? { boxShadow: `inset 0 0 0 1px ${r.severity === "critical" ? "rgba(224,81,58,.45)" : "rgba(240,165,58,.45)"}` } : undefined}>
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="data text-[11px] text-paper-faint">{r.detector} · {info?.instrument}</div>
          <h3 className="font-display text-[19px] leading-tight text-paper">{r.name || info?.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Lamp on color={color} size={16} pulse={fired} />
          <span className="font-label text-[10px] uppercase tracking-[.2em]" style={{ color }}>{fired ? r.severity : "held"}</span>
        </div>
      </header>
      {info && <p className="mb-3 font-type text-[11.5px] leading-snug text-paper-faint">“{info.law}”</p>}
      {numeric && <Bullet r={r} />}
      <p className="text-[12px] leading-snug text-paper-dim">{r.detail}</p>
      {children && <div className="mt-3 min-w-0">{children}</div>}
    </article>
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
          const bg = r === 0 ? "#5c7a34" : r <= 1 ? "#d99a3b" : "#e0513a";
          return (
            <div key={i} title={`digest bit ${i}: ${m} mismatches (limit ${limit})`} className="aspect-square rounded-[2px]"
              style={{ background: bg, boxShadow: f.has(i) ? "0 0 0 2px #fff1c9, 0 0 8px rgba(224,81,58,.8)" : undefined }} />
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-paper-faint">One square per digest bit: olive = 0 mismatches, amber = within the limit of {limit}, red = over it (outlined = failed block).</p>
    </div>
  );
}

const BASIS_COLOR = { Z: "#38bdf8", X: "#a78bfa", Y: "#34d399" } as const;

export function FingerprintPanel({ fp }: { fp: Fingerprint }) {
  const bases = ["Z", "X", "Y"] as const;
  const max = Math.max(0.05, ...bases.map((b) => fp.rates[b]), ...bases.map((b) => fp.baseline_rates?.[b] ?? 0));
  return (
    <div className="space-y-2">
      <p className={`font-display text-[17px] leading-snug ${fp.drift ? "text-amber-hot" : "text-accept"}`}>{fp.label}</p>
      {bases.map((b) => (
        <div key={b} className="flex items-center gap-2 text-[11px]">
          <span className="w-14 text-paper-faint">{b}-basis</span>
          <div className="relative h-3 flex-1 rounded-sm bg-ink-700">
            {fp.baseline_rates && <div className="absolute h-3 rounded-sm bg-paper-mute/50" style={{ width: `${(fp.baseline_rates[b] / max) * 100}%` }} />}
            <div className="relative h-3 rounded-sm" style={{ width: `${(fp.rates[b] / max) * 100}%`, background: BASIS_COLOR[b], opacity: 0.85 }} />
          </div>
          <span className="data w-14 text-right text-paper">{pct(fp.rates[b])}</span>
        </div>
      ))}
      <p className="text-[11px] text-paper-faint">
        Grey = frozen baseline. G-test p = <span className="data">{sci(fp.p_value)}</span>
        {fp.est_intercept_fraction !== null && <> · estimated intercepted fraction ≈ <b className="text-paper">{pct(fp.est_intercept_fraction)}</b></>}
      </p>
      <p className="font-type text-[10.5px] text-paper-mute">An attacker choosing random bases looks isotropic, like noise. She is caught by magnitude (QBER/CUSUM), not shape.</p>
    </div>
  );
}

export function BsmBars({ counts }: { counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const max = Math.max(...counts, 1);
  return (
    <div>
      <div className="flex h-16 items-end gap-2" aria-label="Bell-state-measurement outcome counts">
        {counts.map((c, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end" title={`${["00", "01", "10", "11"][i]}: ${c} (${((c / total) * 100).toFixed(1)}%)`}>
            <div className="w-full rounded-t-sm bg-verdigris/70" style={{ height: `${(c / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 text-center text-[10px] text-paper-faint">{["00", "01", "10", "11"].map((l) => <span key={l} className="data flex-1">{l}</span>)}</div>
      <p className="text-[11px] text-paper-faint">Bell-measurement outcomes should be ~25% each.</p>
    </div>
  );
}

/** Audit path as a ladder, recomputed in the browser with SHA3-256 (RFC 6962 prefixes). */
export function MerkleLadder({ proof, serverValid }: { proof: MerkleProof; serverValid?: boolean }) {
  const [checked, setChecked] = useState<boolean | null>(null);
  const steps = walkProof(proof.leaf, proof.proof);
  const agree = checked !== null && serverValid !== undefined ? checked === serverValid : null;
  return (
    <div className="space-y-3 text-[11.5px]">
      <ol className="space-y-1.5 rounded-md border hair bg-ink/50 p-3">
        {steps.map((s, i) => (
          <li key={i} className="data flex flex-wrap gap-x-2 text-paper-dim">
            <span className="w-12 text-paper-mute">{i === 0 ? "leaf" : `step ${i}`}</span>
            {s.sibling && <span className="text-[#ffb08f]">{s.side === "L" ? "sibling ← " : "sibling → "}{shortHash(s.sibling, 6)}</span>}
            <span className="text-paper">= {shortHash(s.result, 8)}</span>
          </li>
        ))}
      </ol>
      <p className="data text-paper-faint">anchored root <span className="text-amber">{shortHash(proof.root, 12)}</span> (ledger entry #{proof.anchor_index})</p>
      <div className="flex flex-wrap items-center gap-3">
        {serverValid !== undefined && <span className="plate-dark">Server says: <span className={serverValid ? "text-accept" : "text-reject"}>{serverValid ? "VALID" : "INVALID"}</span></span>}
        <button className="btn-primary" onClick={() => setChecked(steps[steps.length - 1].result === proof.root)}>Verify in browser (SHA3-256)</button>
      </div>
      {checked !== null && (
        <div className="flex items-center gap-2">
          <Lamp on color={checked ? "#a9c46c" : "#e0513a"} size={18} />
          <span className={`font-label text-[12px] uppercase tracking-[.16em] ${checked ? "text-accept" : "text-reject"}`}>
            Browser: root {checked ? "matches ✓" : "MISMATCH"}{agree !== null && ` · ${agree ? "agrees with server" : "DISAGREES with server"}`}
          </span>
        </div>
      )}
    </div>
  );
}

/** QR (public proof URL, no credentials), JSON certificate download and print. */
export function CertificateExport({ verdict }: { verdict: Verdict }) {
  const idx = verdict.certificate.ledger_index;
  const url = `${API_URL}/ledger/proof/${idx}`;
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
      <div className="rounded-sm border-2 border-ink p-3 shadow-[5px_5px_0_#0c0a07]" style={{ background: "#e9dcc0" }}>
        <QRCodeSVG value={url} size={120} bgColor="#e9dcc0" fgColor="#0c0a07" level="M" />
      </div>
      <div className="min-w-0 space-y-2 text-[12px] text-paper-dim">
        <p>Scan to fetch the public Merkle proof for ledger entry #{idx}. It contains no credentials.</p>
        <p className="data break-all text-[11px] text-paper-faint">{url}</p>
        <div className="no-print flex flex-wrap gap-2">
          <button className="btn-ghost" onClick={() => downloadJson(`qsentinel-certificate-${idx}.json`, verdict)}>Download certificate (JSON)</button>
          <button className="btn-ghost" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </div>
    </div>
  );
}

/** A SHA3 hash rendered as a punched tabulator card. */
export function PunchCard({ hash }: { hash: string }) {
  const bits = hash.slice(0, 64).split("").flatMap((c) => parseInt(c, 16).toString(2).padStart(4, "0").split("").map(Number));
  const rows = 8;
  const cols = Math.ceil(bits.length / rows);
  return (
    <div>
      <svg viewBox={`0 0 ${cols * 8 + 24} ${rows * 12 + 20}`} className="w-full" aria-label="Transcript hash as a punch card">
        <path d={`M4 4 H${cols * 8 + 12} L${cols * 8 + 20} 12 V${rows * 12 + 16} H4 Z`} fill="#e9dcc0" stroke="#0c0a07" strokeWidth={2} />
        {bits.map((b, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          return b ? <rect key={i} x={12 + c * 8} y={12 + r * 12} width={4} height={7} rx={1} fill="#0c0a07" />
            : <text key={i} x={14 + c * 8} y={18 + r * 12} fontSize={4} textAnchor="middle" fill="#8a7c62" fontFamily="IBM Plex Mono">{r}</text>;
        })}
      </svg>
      <div className="data mt-2 break-all text-[11px] leading-relaxed text-paper-faint">{hash.match(/.{1,8}/g)?.join(" ")}</div>
    </div>
  );
}
