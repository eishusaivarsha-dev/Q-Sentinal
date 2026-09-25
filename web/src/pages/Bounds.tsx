// Security Bounds (docs/frontend-spec.md §4.8): the "how safe are we?" maths, interactive.
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import SeriesChart from "../components/SeriesChart";
import { Card, ErrorNote, Slider } from "../components/ui";
import { log10Chernoff, log10ExactForgery, sciFromLog10 } from "../lib/physics";

export default function Bounds() {
  const cal = useQuery({ queryKey: ["calibration"], queryFn: api.calibration });
  const [n, setN] = useState(256);
  const [tau, setTau] = useState(0.1);
  const [six, setSix] = useState(true);
  const q = six ? 1 / 3 : 1 / 4;
  const ch = log10Chernoff(n, tau, q);
  const ex = log10ExactForgery(n, tau, q);
  const curve = useMemo(() => [16, 32, 64, 128, 192, 256, 384, 512].map((k) => ({ i: k, chernoff: log10Chernoff(k, tau, q), exact: log10ExactForgery(k, tau, q) })), [tau, q]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Security Bounds</h1>
        <p className="text-sm text-slate-400">How likely is a forger to get through? Display-only maths; the backend puts the same numbers in every certificate.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Calculator">
          <div className="space-y-3">
            <Slider label="Coins per block (n)" value={n} onChange={setN} min={16} max={1024} step={16} />
            <Slider label="Noise tolerance (τ)" value={tau} onChange={setTau} min={0} max={0.3} step={0.01} format={(v) => `${(v * 100).toFixed(0)}%`} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={six} onChange={(e) => setSix(e.target.checked)} className="accent-cyan-500" /> six-state encoding (forger wrong ≥ 1/3 per coin; else 1/4)</label>
            <div className="rounded-lg bg-slate-950 p-3 text-sm">
              <p>Exact chance a forger passes one block: <b className="text-cyan-300">{sciFromLog10(ex)}</b></p>
              <p className="text-slate-400">Chernoff guarantee: ≤ {sciFromLog10(ch)}</p>
              <p className="mt-1 text-xs text-slate-500">Limit: up to {Math.floor(tau * n)} of {n} coins may mismatch.</p>
            </div>
          </div>
        </Card>
        <Card title="log₁₀(forger's chance) vs n" className="xl:col-span-2">
          <SeriesChart data={curve} lines={[{ key: "exact", name: "exact", color: "#22d3ee" }, { key: "chernoff", name: "Chernoff bound", color: "#a78bfa" }]}
            refs={[{ y: -16, label: "10^-16 target", color: "#fbbf24" }]} height={260} />
        </Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Rounds needed for ≤ 10^-16 per block (from the backend)">
          {cal.error && <ErrorNote error={cal.error} />}
          <table className="w-full text-left text-sm">
            <thead className="text-slate-400"><tr><th>noise tolerance τ</th><th>two-basis</th><th>six-state</th></tr></thead>
            <tbody>{cal.data?.map((r) => <tr key={r.tau} className="border-t border-slate-800"><td>{(r.tau * 100).toFixed(0)}%</td><td>{r.two_basis_n}</td><td className="font-semibold text-cyan-300">{r.six_state_n}</td></tr>)}</tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">Our default: six-state, n = 256, τ = 10%.</p>
        </Card>
        <Card title="Checked against the simulator">
          <p className="text-sm">A “measure-a-copy” forger was run through the real quantum simulator: <b>0.01358</b> measured vs <b>0.01370</b> exact, a <b className="text-emerald-300">0.9%</b> gap (deliverable D5 requires ≤ 10%).</p>
          <p className="mt-2 font-mono text-xs text-slate-400">python -m qsentinel.detect.validate --n 16 --blocks 40000</p>
        </Card>
      </div>
    </div>
  );
}
