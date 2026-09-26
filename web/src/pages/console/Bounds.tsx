// Security Bounds (docs/frontend-spec.md §4.8): "how safe are we?", interactive. The calculator
// is display-only maths (lib/physics.ts); the backend puts the same numbers in every certificate,
// and the false-alarm check runs 100k Monte-Carlo trials on the server.
import { useMutation, useQuery } from "@tanstack/react-query";
import { Calculator, CheckCircle2, Dices, LineChart, Table2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { pct, sci, sciFromLog10 } from "@/lib/format";
import { log10Chernoff, log10ExactForgery } from "@/lib/physics";
import { TiltCard } from "@/fx/motion";
import SeriesChart from "@/components/charts";
import { Card, Chip, Empty, ErrorNote, KeyVal, PageHeader, Skeleton, Slider, Toggle } from "@/components/ui";

export default function Bounds() {
  const cal = useQuery({ queryKey: ["calibration"], queryFn: () => api.calibration(), staleTime: Infinity });
  const [n, setN] = useState(256);
  const [tau, setTau] = useState(0.1);
  const [six, setSix] = useState(true);
  const [noise, setNoise] = useState(0.04);
  const q = six ? 1 / 3 : 1 / 4;
  const ch = log10Chernoff(n, tau, q);
  const ex = log10ExactForgery(n, tau, q);
  const curve = useMemo(() => [16, 32, 64, 96, 128, 192, 256, 384, 512].map((k) => ({ i: k, chernoff: log10Chernoff(k, tau, q), exact: log10ExactForgery(k, tau, q) })), [tau, q]);
  const far = useMutation({ mutationFn: () => api.far(Math.min(n, 1024), tau, noise) });

  return (
    <div>
      <PageHeader eyebrow="Prove · mathematics" title="Security" accent="Bounds"
        lede="How likely is a forger to get through, and how often does an honest signature raise a false alarm? Closed-form bounds, checked against simulation. Headline: (3/4)¹²⁸ ≈ 1.02 × 10⁻¹⁶." />
      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_2fr]">
        <Card glow title="Calculator" sub="client-side · display only" icon={Calculator}>
          <div className="space-y-5">
            <Slider label="Coins per block (n)" value={n} onChange={setN} min={16} max={1024} step={16} />
            <Slider label="Noise tolerance (τ)" value={tau} onChange={setTau} min={0} max={0.3} step={0.01} format={(v) => pct(v, 0)} />
            <Toggle on={six} onChange={setSix} label={six ? "Six-state protocol" : "Two-basis protocol"} sub={six ? "a wrong guess mismatches ≥ 1/3 of the time" : "a wrong guess mismatches ≥ 1/4 of the time"} />
            <TiltCard max={5}>
              <div className="rounded-2xl border border-brand/25 p-5 text-center" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgb(var(--brand) / .12), transparent 70%)" }}>
                <div className="label">Exact chance a forger passes one block</div>
                <div className="data mt-2 text-[34px] font-bold leading-none text-brand">{sciFromLog10(ex)}</div>
                <div className="mt-2 text-[14px] text-ink-3">Chernoff guarantee ≤ <span className="data text-ink">{sciFromLog10(ch)}</span></div>
                <div className="mt-1 text-[13px] text-ink-3">up to {Math.floor(tau * n)} of {n} coins may mismatch</div>
              </div>
            </TiltCard>
          </div>
        </Card>
        <Card title="log₁₀(forger's chance) vs n" sub={`τ = ${pct(tau, 0)} · q = ${six ? "1/3" : "1/4"}`} icon={LineChart}>
          <SeriesChart data={curve} lines={[{ key: "exact", name: "exact binomial", token: "brand" }, { key: "chernoff", name: "Chernoff bound", token: "violet", dashed: true }]}
            refs={[{ y: -16, label: "10⁻¹⁶ target" }]} height={320} />
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Rounds needed for ≤ 10⁻¹⁶ per block" sub="GET /calibration" icon={Table2}>
          {cal.error && <ErrorNote error={cal.error} />}
          {!cal.data && !cal.error && <Skeleton className="h-48" />}
          {cal.data && (
            <table className="w-full text-left text-[14px]">
              <thead className="label !text-[12px]"><tr><th className="py-2">noise tolerance τ</th><th>two-basis</th><th>six-state</th></tr></thead>
              <tbody>{cal.data.map((r) => <tr key={r.tau} className="data border-t border-line"><td className="py-2">{pct(r.tau, 0)}</td><td>{r.two_basis_n}</td><td className="font-semibold text-brand">{r.six_state_n}</td></tr>)}</tbody>
            </table>
          )}
          <p className="mt-3 text-[13px] text-ink-3">Default: six-state, n = 256, τ = 10%.</p>
        </Card>
        <Card title="False-alarm rate" sub="GET /calibration/far · 100,000 honest blocks" icon={Dices}
          actions={far.data && <Chip tone={far.data.exact_inside_ci ? "ok" : "bad"}>{far.data.exact_inside_ci ? "exact inside 95% CI" : "outside CI"}</Chip>}>
          <Slider label="Honest channel noise" value={noise} onChange={setNoise} max={0.12} step={0.005} format={(v) => pct(v, 1)} />
          <button className="btn-ghost mt-4 w-full" disabled={far.isPending} onClick={() => far.mutate()}>{far.isPending ? "Simulating 100k blocks…" : `Simulate at n = ${Math.min(n, 1024)}, τ = ${pct(tau, 0)}`}</button>
          <div className="mt-4">
            {far.error && <ErrorNote error={far.error} />}
            {far.data ? (
              <KeyVal cols={2} items={[["Empirical", sci(far.data.far_empirical)], ["Exact", sci(far.data.far_exact)], ["95% CI", `${sci(far.data.ci95[0])} – ${sci(far.data.ci95[1])}`],
                ["Chernoff ≤", sci(far.data.chernoff_bound)], ["Hoeffding ≤", sci(far.data.hoeffding_bound)], ["False alarms", `${far.data.false_alarms} / ${far.data.trials.toLocaleString()}`]]} />
            ) : !far.error && <Empty>How often would an honest block on a noisy channel be rejected?</Empty>}
          </div>
        </Card>
        <Card title="Checked against the simulator" sub="D5 deliverable" icon={CheckCircle2}>
          <p className="text-[15px] leading-relaxed text-ink-2">A “measure-a-copy” forger was run through the real quantum simulator: <b className="data text-ink">0.01358</b> measured vs <b className="data text-ink">0.01370</b> exact, a <b className="text-ok">0.9%</b> gap (the deliverable requires ≤ 10%).</p>
          <p className="data mt-4 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] text-ink-3">python -m qsentinel.detect.validate --n 16 --blocks 40000</p>
        </Card>
      </div>
    </div>
  );
}
