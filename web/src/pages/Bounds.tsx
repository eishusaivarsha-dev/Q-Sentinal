// Security Bounds (docs/frontend-spec.md §4.8): the "how safe are we?" maths, interactive.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { sciFromLog10 } from "@/lib/format";
import { log10Chernoff, log10ExactForgery } from "@/lib/physics";
import { Toggle } from "@/components/art/Instruments";
import SeriesChart from "@/components/channel/SeriesChart";
import { ErrorNote, PageHeader, Panel, Slider } from "@/components/shell/primitives";

export default function Bounds() {
  const cal = useQuery({ queryKey: ["calibration"], queryFn: () => api.calibration() });
  const [n, setN] = useState(256);
  const [tau, setTau] = useState(0.1);
  const [six, setSix] = useState(true);
  const q = six ? 1 / 3 : 1 / 4;
  const ch = log10Chernoff(n, tau, q);
  const ex = log10ExactForgery(n, tau, q);
  const curve = useMemo(() => [16, 32, 64, 128, 192, 256, 384, 512].map((k) => ({ i: k, chernoff: log10Chernoff(k, tau, q), exact: log10ExactForgery(k, tau, q) })), [tau, q]);

  return (
    <div>
      <PageHeader directive="Directive 08 · Proofs" title="Security Bounds"
        lede="How likely is a forger to get through? Display-only maths — the backend puts the same numbers in every certificate. Headline: (3/4)¹²⁸ = 1.02 × 10⁻¹⁶." />
      <div className="mb-5 grid gap-5 xl:grid-cols-[1fr_2fr]">
        <Panel title="Calculator" code="client-side, display only">
          <div className="space-y-4">
            <Slider label="Coins per block (n)" value={n} onChange={setN} min={16} max={1024} step={16} />
            <Slider label="Noise tolerance (τ)" value={tau} onChange={setTau} min={0} max={0.3} step={0.01} format={(v) => `${(v * 100).toFixed(0)}%`} />
            <Toggle on={six} onChange={setSix} label={six ? "Six-state (wrong ≥ 1/3)" : "Two-basis (wrong ≥ 1/4)"} />
            <div className="rounded-md border hair bg-ink/60 p-4 text-center">
              <div className="label">Exact chance a forger passes one block</div>
              <div className="data phosphor mt-1 text-[30px] leading-none">{sciFromLog10(ex)}</div>
              <div className="mt-2 text-[12px] text-paper-faint">Chernoff guarantee ≤ <span className="data">{sciFromLog10(ch)}</span></div>
              <div className="mt-1 font-type text-[11px] text-paper-mute">up to {Math.floor(tau * n)} of {n} coins may mismatch</div>
            </div>
          </div>
        </Panel>
        <Panel title="log₁₀(forger's chance) vs n" code={`τ = ${(tau * 100).toFixed(0)}% · q = ${six ? "1/3" : "1/4"}`}>
          <SeriesChart data={curve} lines={[{ key: "exact", name: "exact binomial", color: "#ffc15e" }, { key: "chernoff", name: "Chernoff bound", color: "#a78bfa" }]}
            refs={[{ y: -16, label: "10⁻¹⁶ target", color: "#e0513a" }]} height={280} />
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Rounds needed for ≤ 10⁻¹⁶ per block" code="GET /calibration">
          {cal.error && <ErrorNote error={cal.error} />}
          <table className="w-full text-left text-[12.5px]">
            <thead className="label"><tr><th className="py-1 font-normal">noise tolerance τ</th><th className="font-normal">two-basis</th><th className="font-normal">six-state</th></tr></thead>
            <tbody>{cal.data?.map((r) => <tr key={r.tau} className="data border-t hair"><td className="py-1.5">{(r.tau * 100).toFixed(0)}%</td><td>{r.two_basis_n}</td><td className="text-amber">{r.six_state_n}</td></tr>)}</tbody>
          </table>
          <p className="mt-2 font-type text-[11px] text-paper-faint">Default: six-state, n = 256, τ = 10%.</p>
        </Panel>
        <Panel title="Checked against the simulator" code="D5 deliverable">
          <p className="text-[13px] text-paper-dim">A “measure-a-copy” forger was run through the real quantum simulator: <b className="data text-paper">0.01358</b> measured vs <b className="data text-paper">0.01370</b> exact, a <b className="text-accept">0.9%</b> gap (the deliverable requires ≤ 10%).</p>
          <p className="data mt-3 text-[11px] text-paper-faint">python -m qsentinel.detect.validate --n 16 --blocks 40000</p>
        </Panel>
      </div>
    </div>
  );
}
