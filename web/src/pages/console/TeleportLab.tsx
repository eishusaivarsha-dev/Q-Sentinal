// Teleport Lab: one teleportation round, exactly. The backend evolves the full 3-qubit density
// matrix (qsentinel/quantum/statevector.py): Bell pair -> channel -> Bell-state measurement ->
// two classical bits -> Pauli correction. The 3-D sphere shows the input, what arrives before the
// correction, and the corrected output. Education and display only; never a verdict.
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Atom, BarChart3, Check, Copy, Cpu, Orbit, Play } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "@/api/client";
import type { ChannelIn, TeleportResult } from "@/api/types";
import { cn } from "@/lib/cn";
import { pct, sci } from "@/lib/format";
import { usePalette } from "@/three/common";
import { Card, Chip, Empty, ErrorNote, Meter, PageHeader, Skeleton, Slider, Toggle } from "@/components/ui";
import { BsmBars } from "@/components/verdict/parts";

const BlochSphere = lazy(() => import("@/three/BlochSphere"));

const STATES: [string, string, string][] = [["0", "|0⟩", "Z"], ["1", "|1⟩", "Z"], ["+", "|+⟩", "X"], ["-", "|−⟩", "X"], ["+i", "|+i⟩", "Y"], ["-i", "|−i⟩", "Y"]];
const STEPS = ["Bell pair shared", "Bell-state measurement", "2 classical bits sent", "Pauli correction"];
const CORR: Record<string, string> = { I: "nothing (I)", X: "a bit flip (X)", Z: "a phase flip (Z)", XZ: "both (XZ)" };

function Protocol({ r }: { r: TeleportResult }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    setStep(0);
    const t = setInterval(() => setStep((s) => (s < STEPS.length - 1 ? s + 1 : s)), 700);
    return () => clearInterval(t);
  }, [r]);
  const probs = Object.entries(r.bsm_probabilities) as [string, number][];
  return (
    <div className="space-y-5">
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="text-center">
            <motion.div animate={{ scale: i === step ? 1.08 : 1 }} className={cn("mx-auto flex h-10 w-10 items-center justify-center rounded-full border-2 font-mono text-[14px] font-bold transition-colors",
              i <= step ? "border-brand bg-brand text-white" : "border-line-2 text-ink-3")}>{i + 1}</motion.div>
            <div className={cn("mt-1.5 text-[12.5px] font-semibold leading-tight", i <= step ? "text-ink" : "text-ink-3")}>{s}</div>
          </li>
        ))}
      </ol>
      <div>
        <div className="label mb-2 !text-[12px]">Bell-measurement outcome probabilities</div>
        <div className="space-y-1.5">
          {probs.map(([k, p]) => (
            <div key={k} className="flex items-center gap-3 text-[13px]">
              <span className={cn("data w-8", k === r.bsm ? "font-bold text-brand" : "text-ink-3")}>{k}</span>
              <div className="flex-1"><Meter value={p} max={0.5} tone={k === r.bsm ? "brand" : "neutral"} height={8} /></div>
              <span className="data w-14 text-right text-ink">{pct(p, 1)}</span>
            </div>
          ))}
        </div>
      </div>
      <AnimatePresence mode="wait">
        <motion.p key={r.bsm + r.correction + step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-[15px] leading-relaxed text-ink-2">
          Measured <b className="data text-brand">{r.bsm}</b>, so the verifier applies {CORR[r.correction]} to recover the state. {step >= 3 && <>Output fidelity <b className="data text-ink">{r.fidelity.toFixed(4)}</b>.</>}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

export default function TeleportLab() {
  const p = usePalette();
  const [state, setState] = useState<string | null>("+");
  const [theta, setTheta] = useState(1.1);
  const [phi, setPhi] = useState(0.8);
  const [noise, setNoise] = useState(0);
  const [eve, setEve] = useState(0);
  const [ent, setEnt] = useState(0);
  const [showRaw, setShowRaw] = useState(true);
  const [shots, setShots] = useState(8192);
  const [copied, setCopied] = useState(false);
  const channel: ChannelIn = { depolarizing: noise, intercept_fraction: eve, entangle_fraction: ent };
  const tp = useMutation({ mutationFn: () => api.teleport(state ? { state, channel } : { state: null, theta, phi, channel }) });
  const bsm = useMutation({ mutationFn: () => api.bsm(shots, channel) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { tp.mutate(); }, []);
  const r = tp.data;
  const arrows = r ? [
    { key: "in", vec: r.input_bloch, color: p.brand, width: 0.03 },
    ...(showRaw ? [{ key: "raw", vec: r.received_bloch, color: p.warn, opacity: 0.8 }] : []),
    { key: "out", vec: r.output_bloch, color: p.ok, width: 0.026 },
  ] : [];

  return (
    <div>
      <PageHeader eyebrow="Observe · quantum substrate" title="Teleport" accent="Lab"
        lede="The exact state-vector engine behind the protocol: one qubit teleported over a Bell pair, through a channel you control. Stim samples 65k rounds in milliseconds; this explains one round, exactly." />
      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <div className="min-w-0 space-y-6">
          <Card title="State to teleport" icon={Atom}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {STATES.map(([k, label, basis]) => (
                <button key={k} onClick={() => setState(k)} className={cn("rounded-2xl border px-2 py-2.5 text-center transition-all",
                  state === k ? "border-brand/60 bg-brand/10 text-brand" : "border-line bg-surface text-ink hover:border-brand/30")}>
                  <div className="data text-[17px] font-bold">{label}</div><div className="text-[11.5px] text-ink-3">{basis} basis</div>
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-4 rounded-2xl border border-line bg-surface-2 p-4">
              <Toggle on={state === null} onChange={(v) => setState(v ? null : "+")} label="Arbitrary state" sub="any point on the sphere (θ, φ)" />
              {state === null && (
                <>
                  <Slider label="θ (polar)" value={theta} onChange={setTheta} max={Math.PI} step={0.01} format={(v) => `${v.toFixed(2)} rad`} />
                  <Slider label="φ (azimuth)" value={phi} onChange={setPhi} min={-Math.PI} max={Math.PI} step={0.01} format={(v) => `${v.toFixed(2)} rad`} />
                </>
              )}
            </div>
          </Card>
          <Card title="Channel" sub="what happens to the verifier's half in transit" icon={Orbit}>
            <div className="space-y-5">
              <Slider label="Honest noise (depolarising)" value={noise} onChange={setNoise} max={0.3} step={0.005} format={(v) => pct(v, 1)} />
              <Slider label="Eve intercept-resends" value={eve} onChange={setEve} format={(v) => pct(v, 0)} />
              <Slider label="Eve entangles-and-measures" value={ent} onChange={setEnt} format={(v) => pct(v, 0)} />
              <button className="btn-primary w-full" disabled={tp.isPending} onClick={() => tp.mutate()}><Play size={16} />{tp.isPending ? "Teleporting…" : "Teleport"}</button>
              {tp.error && <ErrorNote error={tp.error} />}
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="card relative overflow-hidden">
            <div className="absolute left-5 top-5 z-10 flex flex-wrap gap-2 text-[13px]">
              <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-ink-2"><span className="h-2 w-2 rounded-full bg-brand" />input</span>
              {showRaw && <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-ink-2"><span className="h-2 w-2 rounded-full bg-warn" />before correction</span>}
              <span className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold text-ink-2"><span className="h-2 w-2 rounded-full bg-ok" />output</span>
            </div>
            <div className="absolute right-5 top-5 z-10"><button className="glass rounded-full px-3 py-1 text-[13px] font-semibold text-ink-2" onClick={() => setShowRaw(!showRaw)}>{showRaw ? "hide" : "show"} raw</button></div>
            <Suspense fallback={<Skeleton className="h-[440px] rounded-none" />}>
              <BlochSphere arrows={arrows} height={440} />
            </Suspense>
            {r && (
              <div className="grid grid-cols-3 gap-4 border-t border-line p-5">
                <div><div className="label !text-[11.5px]">Fidelity</div><div className={cn("data text-[26px] font-semibold", r.fidelity > 0.99 ? "text-ok" : r.fidelity > 0.8 ? "text-warn" : "text-bad")}>{r.fidelity.toFixed(4)}</div></div>
                <div><div className="label !text-[11.5px]">Error rate</div><div className="data text-[26px] font-semibold text-ink">{pct(r.error_rate, 2)}</div></div>
                <div><div className="label !text-[11.5px]">Six-state QBER</div><div className="data text-[26px] font-semibold text-ink">{pct(r.six_state_error_rate, 2)}</div></div>
              </div>
            )}
          </section>
          <Card title="The protocol, step by step" icon={Cpu}>{r ? <Protocol r={r} /> : <Skeleton className="h-48" />}</Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card title="Bell-measurement statistics" sub="POST /quantum/bsm · χ² uniformity test" icon={BarChart3}
          actions={bsm.data && <Chip tone={bsm.data.uniform ? "ok" : "bad"}>{bsm.data.uniform ? "uniform" : "NOT uniform"}</Chip>}>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[220px] flex-1"><Slider label="Shots" value={shots} onChange={setShots} min={512} max={65536} step={512} format={(v) => v.toLocaleString()} /></div>
            <button className="btn-ghost" disabled={bsm.isPending} onClick={() => bsm.mutate()}>{bsm.isPending ? "Measuring…" : "Measure"}</button>
          </div>
          <div className="mt-5">
            {bsm.data ? (
              <>
                <BsmBars counts={["00", "01", "10", "11"].map((k) => bsm.data!.counts[k] ?? 0)} />
                <p className="data mt-2 text-[13px] text-ink-3">χ² = {bsm.data.chi2.toFixed(2)} · p = {sci(bsm.data.p_value)} · {bsm.data.shots.toLocaleString()} shots</p>
              </>
            ) : bsm.error ? <ErrorNote error={bsm.error} /> : <Empty>A fair Bell measurement gives each outcome 25% of the time, whatever the state and even under attack — the outcomes carry no information.</Empty>}
          </div>
        </Card>
        <Card title="Run it on real hardware" sub="OpenQASM 2.0 for this state" icon={Cpu}
          actions={r && <button className="btn-ghost btn-sm" onClick={() => { void navigator.clipboard?.writeText(r.qasm); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button>}>
          {r ? <pre className="data max-h-[300px] overflow-auto rounded-2xl border border-line bg-surface-2 p-4 text-[12.5px] leading-relaxed text-ink-2" data-lenis-prevent>{r.qasm}</pre> : <Skeleton className="h-48" />}
        </Card>
      </div>
    </div>
  );
}
