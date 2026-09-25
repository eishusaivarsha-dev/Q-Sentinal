// Pieces of the proof certificate (docs/frontend-spec.md §4.4 and §7).
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { API_URL } from "../api/client";
import type { DetectorResult, Fingerprint, MerkleProof, Verdict } from "../api/types";
import { pct, sci } from "../lib/physics";
import { walkProof } from "../lib/merkle";
import { downloadJson } from "../state/session";
import { Bullet, Button, Pill, severityTone } from "./ui";

export function DetectorCard({ r, children }: { r: DetectorResult; children?: React.ReactNode }) {
  // D1 is informational (noise legitimately causes a few mismatches) and D5's statistic is an age.
  const numeric = typeof r.statistic === "number" && typeof r.threshold === "number" && !["D1", "D5"].includes(r.detector);
  return (
    <div className={`rounded-xl border p-4 ${r.alert && r.severity !== "info" ? (r.severity === "critical" ? "border-rose-700 bg-rose-950/30" : "border-amber-700 bg-amber-950/20") : "border-slate-800 bg-slate-900/80"}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold"><span className="font-mono text-cyan-300">{r.detector}</span> {r.name}</h3>
        <Pill tone={r.alert && r.severity !== "info" ? severityTone(r.severity) : "ok"}>{r.alert && r.severity !== "info" ? r.severity : "ok"}</Pill>
      </div>
      {numeric && (
        <>
          <p className="mt-2 text-xs text-slate-400">statistic {sci(r.statistic)} · threshold {sci(r.threshold)}</p>
          <Bullet value={r.statistic as number} threshold={r.threshold as number}
            max={r.detector === "D3" ? 3 : Math.max((r.threshold as number) * 2.5, r.statistic as number, 1e-9)} higherIsBad={r.detector !== "D3"} />
        </>
      )}
      <p className="mt-2 text-sm text-slate-300">{r.detail}</p>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

export function BlockHeatmap({ mismatches, limit, failed }: { mismatches: number[]; limit: number; failed: number[] }) {
  const cols = Math.ceil(Math.sqrt(mismatches.length));
  const f = new Set(failed);
  return (
    <div>
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {mismatches.map((m, i) => {
          const r = limit > 0 ? m / limit : m > 0 ? 2 : 0;
          const bg = r === 0 ? "bg-emerald-600/70" : r <= 1 ? "bg-amber-500/80" : "bg-rose-600";
          return <div key={i} title={`digest bit ${i}: ${m} mismatches (limit ${limit})`} className={`aspect-square rounded-sm ${bg} ${f.has(i) ? "ring-2 ring-white" : ""}`} />;
        })}
      </div>
      <p className="mt-1 text-xs text-slate-400">One square per digest bit: green = 0 mismatches, amber = within the limit of {limit}, red = over it.</p>
    </div>
  );
}

export function ChshGauge({ s, fidelity }: { s: number; fidelity?: number }) {
  const x = (v: number) => `${(Math.max(0, Math.min(3, v)) / 3) * 100}%`;
  return (
    <div>
      <div className="relative h-4 rounded-full" style={{ background: "linear-gradient(90deg, #9f1239 0%, #9f1239 66.6%, #0e7490 66.6%, #0e7490 100%)" }}>
        <div className="absolute top-[-6px] h-7 w-1.5 rounded bg-white" style={{ left: x(s) }} />
        <div className="absolute top-[-3px] h-6 w-0.5 bg-cyan-200" style={{ left: x(2 * Math.SQRT2) }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-slate-400"><span>0</span><span>2 classical limit</span><span>2.83 perfect</span></div>
      <p className="mt-1 text-sm">S = <b>{s.toFixed(3)}</b>{fidelity !== undefined && <> · fidelity F = <b>{fidelity.toFixed(3)}</b></>}</p>
    </div>
  );
}

export function FingerprintPanel({ fp }: { fp: Fingerprint }) {
  const bases = ["Z", "X", "Y"] as const;
  const colors = { Z: "bg-sky-400", X: "bg-violet-400", Y: "bg-emerald-400" };
  const max = Math.max(0.05, ...bases.map((b) => fp.rates[b]), ...bases.map((b) => fp.baseline_rates?.[b] ?? 0));
  return (
    <div className="space-y-2">
      <p className={`text-sm font-semibold ${fp.drift ? "text-amber-300" : "text-emerald-300"}`}>{fp.label}</p>
      {bases.map((b) => (
        <div key={b} className="flex items-center gap-2 text-xs">
          <span className="w-16 text-slate-400">{b}-basis</span>
          <div className="relative h-3 flex-1 rounded bg-slate-800">
            {fp.baseline_rates && <div className="absolute h-3 rounded bg-slate-600" style={{ width: `${(fp.baseline_rates[b] / max) * 100}%` }} />}
            <div className={`relative h-3 rounded ${colors[b]}`} style={{ width: `${(fp.rates[b] / max) * 100}%`, opacity: 0.85 }} />
          </div>
          <span className="w-14 text-right font-mono">{pct(fp.rates[b])}</span>
        </div>
      ))}
      <p className="text-xs text-slate-400">
        Grey = frozen baseline. G-test p = {sci(fp.p_value)}
        {fp.est_intercept_fraction !== null && <> · estimated intercepted fraction ≈ <b className="text-slate-200">{pct(fp.est_intercept_fraction)}</b></>}
      </p>
      <p className="text-xs text-slate-500">A random-basis attacker looks isotropic, like noise; she is caught by magnitude (QBER, CUSUM), not shape.</p>
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
            <div className="w-full rounded-t bg-violet-500/70" style={{ height: `${(c / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 text-center text-[10px] text-slate-400">{["00", "01", "10", "11"].map((l) => <span key={l} className="flex-1">{l}</span>)}</div>
      <p className="text-xs text-slate-500">Bell-measurement outcomes should be ~25% each.</p>
    </div>
  );
}

export function MerkleLadder({ proof }: { proof: MerkleProof }) {
  const [checked, setChecked] = useState<boolean | null>(null);
  const steps = walkProof(proof.leaf, proof.proof);
  return (
    <div className="space-y-2 text-xs">
      <ol className="space-y-1 font-mono">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-wrap gap-2">
            <span className="w-14 text-slate-500">{i === 0 ? "leaf" : `step ${i}`}</span>
            {s.sibling && <span className="text-orange-300">{s.side === "L" ? "sibling ← " : "sibling → "}{s.sibling.slice(0, 16)}…</span>}
            <span className="text-cyan-300">= {s.result.slice(0, 16)}…</span>
          </li>
        ))}
      </ol>
      <p className="font-mono">anchored root {proof.root.slice(0, 32)}… (ledger entry #{proof.anchor_index})</p>
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => setChecked(steps[steps.length - 1].result === proof.root)}>Verify in browser (SHA3-256)</Button>
        {checked !== null && <Pill tone={checked ? "ok" : "bad"}>{checked ? "root matches ✓" : "MISMATCH"}</Pill>}
      </div>
    </div>
  );
}

export function CertificateExport({ verdict }: { verdict: Verdict }) {
  const idx = verdict.certificate.ledger_index;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="rounded bg-white p-2"><QRCodeSVG value={`${API_URL}/ledger/proof/${idx}`} size={96} /></div>
      <div className="space-y-2">
        <p className="text-xs text-slate-400">Scan to fetch the public Merkle proof for ledger entry #{idx}.</p>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => downloadJson(`qsentinel-certificate-${idx}.json`, verdict)}>Download certificate (JSON)</Button>
          <Button variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function InfoMeter({ metrics }: { metrics: Record<string, any> }) {
  if (metrics.eve_accuracy_with_bits === undefined) return null;
  const rows: [string, number, string, string][] = [
    ["Eve's accuracy if she can also read the 2 correction bits", metrics.eve_accuracy_with_bits, "bg-orange-400", "right"],
    ["…if the correction bits go through the post-quantum tunnel", metrics.eve_accuracy_without_bits, "bg-slate-400", "= coin flip, zero information"],
    ["Damage she caused on the qubits she touched", metrics.disturbance, "bg-cyan-400", "errors → alarms fire"],
  ];
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Information vs disturbance</h3>
      {rows.map(([label, v, color, note]) => (
        <div key={label} className="text-xs">
          <div className="flex justify-between text-slate-300"><span>{label}</span><span className="font-mono">{pct(v, 0)} {note}</span></div>
          <div className="mt-1 h-3 rounded bg-slate-800"><div className={`h-3 rounded ${color}`} style={{ width: `${v * 100}%` }} /></div>
        </div>
      ))}
      <p className="text-xs text-slate-400">Teleportation is a quantum one-time pad: encrypt 2 bits per qubit and a quantum-only spy is left with nothing but a trail.</p>
    </div>
  );
}
