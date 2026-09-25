// Channel Observatory (docs/frontend-spec.md §4.5): frozen baseline vs now, the channel
// ellipsoid, time series, and live probes you can fire at the link.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "../api/client";
import type { ChannelIn, LinkStatus, Pauli, Rates } from "../api/types";
import ChannelEllipsoid from "../components/ChannelEllipsoid";
import SeriesChart from "../components/SeriesChart";
import { Button, Card, Empty, ErrorNote, Pill } from "../components/ui";
import { chsh, pct } from "../lib/physics";
import { useSession } from "../state/session";

const PROBES: [string, ChannelIn][] = [
  ["Honest", {}],
  ["Noisy (3%)", { depolarizing: 0.03 }],
  ["Stealth probe: 5% in Z", { intercept_fraction: 0.05, eve_bases: [0] }],
  ["Probe 20% in X", { intercept_fraction: 0.2, eve_bases: [1] }],
  ["Random-basis intercept 30%", { intercept_fraction: 0.3 }],
  ["Entangle-and-measure 50% (Y)", { entangle_fraction: 0.5, entangle_basis: 2 }],
];

function baselineRates(l: LinkStatus): Rates {
  const r = (k: string) => (l.baseline.per_basis[k] ? l.baseline.per_basis[k][0] / (l.baseline.per_basis[k][1] || 1) : 0);
  return { Z: r("0"), X: r("1"), Y: r("2") };
}

function pauliOf(r: Rates): Pauli {
  const c = (x: number) => Math.max(0, x);
  return { pX: c((r.Z + r.Y - r.X) / 2), pY: c((r.Z + r.X - r.Y) / 2), pZ: c((r.X + r.Y - r.Z) / 2) };
}

function Probes() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const probe = useMutation({
    mutationFn: async (channel: ChannelIn) => api.verify(await api.sign(`probe ${Date.now()}`), "bob", channel),
    onSuccess: () => qc.invalidateQueries(),
  });
  const d4 = probe.data?.results.find((r) => r.detector === "D4");
  return (
    <Card title="Send a signature through a chosen channel (alice → bob)">
      <div className="flex flex-wrap gap-2">
        {PROBES.map(([label, ch]) => (
          <Button key={label} variant={Object.keys(ch).length ? "ghost" : "ok"} disabled={probe.isPending || replay} onClick={() => probe.mutate(ch)}>{label}</Button>
        ))}
      </div>
      {probe.error && <p className="mt-2 text-sm text-rose-300">{errorText(probe.error)}</p>}
      {probe.data && d4 && (
        <p className="mt-2 text-sm">
          <Pill tone={probe.data.decision === "ACCEPT" ? "ok" : "bad"}>{probe.data.decision}</Pill>{" "}
          QBER {pct(d4.extra.qber, 2)} · fingerprint: <span className="text-amber-200">{d4.extra.fingerprint.label}</span>
          {d4.extra.fingerprint.est_intercept_fraction !== null && <> · estimated size {pct(d4.extra.fingerprint.est_intercept_fraction)}</>}
        </p>
      )}
    </Card>
  );
}

export default function Channels() {
  const links = useQuery({ queryKey: ["links", 200], queryFn: () => api.links(200), refetchInterval: 2000 });
  const names = Object.keys(links.data ?? {});
  const [sel, setSel] = useState<string | null>(null);
  const name = sel && names.includes(sel) ? sel : names[0];
  const l = name ? links.data?.[name] : undefined;
  const base = l ? baselineRates(l) : null;
  const series = (l?.history ?? []).map((h, i) => ({ i: i + 1, qber: h.qber, chsh: h.chsh, cusum: h.cusum }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Channel Observatory</h1>
        <p className="text-sm text-slate-400">Every honest signature doubles as channel tomography. Errors in each basis reveal which Pauli flips hit the qubits – and where Eve is listening.</p>
      </div>
      {links.error && <ErrorNote error={links.error} />}
      <Probes />
      {!l || !base ? <Empty>No link yet – send an honest signature above.</Empty> : (
        <>
          <div className="flex flex-wrap gap-2">
            {names.map((n) => <button key={n} onClick={() => setSel(n)} className={`rounded-full px-3 py-1 font-mono text-xs ${n === name ? "bg-cyan-700" : "bg-slate-800"}`}>{n} · {links.data?.[n].status}</button>)}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="Frozen baseline (sealed)" right={<Pill tone="info">on the ledger</Pill>}>
              <p className="mb-2 text-xs text-slate-400">Measured once at commissioning ({l.baseline.pairs.toLocaleString()} Bell pairs). Live traffic never changes it, so a slow attacker can't drag “normal” along with her.</p>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-slate-400">QBER</dt><dd>{pct(l.baseline.qber, 2)}</dd>
                <dt className="text-slate-400">error Z / X / Y</dt><dd className="font-mono text-xs">{pct(base.Z, 2)} / {pct(base.X, 2)} / {pct(base.Y, 2)}</dd>
                <dt className="text-slate-400">CHSH</dt><dd>{chsh(l.baseline.correlators.ZZ, l.baseline.correlators.XX).toFixed(3)}</dd>
                <dt className="text-slate-400">verifications</dt><dd>{l.verifications}</dd>
                <dt className="text-slate-400">CUSUM alarms</dt><dd>{l.cusum_alarms}</dd>
              </dl>
            </Card>
            <Card title="Channel ellipsoid" right={<Pill tone={l.status === "critical" ? "bad" : l.status === "warning" ? "warn" : "ok"}>{l.status}</Pill>}>
              <ChannelEllipsoid rates={l.latest?.rates ?? null} baseline={base} excess={l.latest?.excess_pauli} height={280} />
              <p className="text-xs text-slate-400">Axis length = 1 − 2 × error rate. Ghost = baseline. Orange axis = the basis Eve is probing. Blue Z (up/down), violet X, green Y.</p>
              <p className={`mt-1 text-sm ${l.latest?.fingerprint_drift ? "text-amber-300" : "text-emerald-300"}`}>{l.latest?.fingerprint}</p>
            </Card>
            <Card title="Pauli fingerprint (latest vs baseline)">
              {l.latest?.pauli ? (
                <div className="space-y-2">
                  {(["pX", "pY", "pZ"] as const).map((k) => {
                    const now = l.latest!.pauli![k];
                    const was = pauliOf(base)[k];
                    const max = Math.max(0.05, now, was);
                    return (
                      <div key={k} className="text-xs">
                        <div className="flex justify-between"><span>{k} ({k === "pZ" ? "Eve along Z" : k === "pX" ? "Eve along X" : "Eve along Y"})</span><span className="font-mono">{pct(now, 2)} (was {pct(was, 2)})</span></div>
                        <div className="relative mt-1 h-3 rounded bg-slate-800">
                          <div className="absolute h-3 rounded bg-slate-600" style={{ width: `${(was / max) * 100}%` }} />
                          <div className="relative h-3 rounded bg-orange-400/80" style={{ width: `${(now / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-sm">Estimated intercepted fraction ≈ <b>{pct(l.latest.est_intercept_fraction)}</b></p>
                </div>
              ) : <Empty>Needs all three bases (six-state mode).</Empty>}
            </Card>
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="QBER per verification"><SeriesChart data={series} lines={[{ key: "qber", name: "QBER", color: "#38bdf8" }]} refs={[{ y: 0.11, label: "alarm 11%", color: "#fb7185" }, { y: l.baseline.qber, label: "baseline", color: "#94a3b8" }]} /></Card>
            <Card title="CHSH entanglement score"><SeriesChart data={series} domain={[0, 3]} lines={[{ key: "chsh", name: "S", color: "#a78bfa" }]} refs={[{ y: 2, label: "classical limit", color: "#fb7185" }, { y: 2.83, label: "perfect", color: "#22d3ee" }]} /></Card>
            <Card title="CUSUM running total"><SeriesChart data={series} lines={[{ key: "cusum", name: "CUSUM", color: "#fbbf24" }]} refs={[{ y: 0.03, label: "alarm", color: "#fb7185" }]} /></Card>
          </div>
        </>
      )}
    </div>
  );
}
