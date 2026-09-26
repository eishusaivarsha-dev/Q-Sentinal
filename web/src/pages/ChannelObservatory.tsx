// Channel Observatory (docs/frontend-spec.md §4.5): frozen baseline vs now, the channel
// ellipsoid, time series, and live probes you can fire at the link.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/client";
import { useLinks } from "@/api/hooks";
import type { ChannelIn } from "@/api/types";
import { pct } from "@/lib/format";
import { baselineRates, chsh, ellipsoidAxes, ellipsoidShape, pauliOf } from "@/lib/physics";
import { useSession } from "@/state/session";
import ChannelEllipsoid from "@/components/channel/ChannelEllipsoid";
import SeriesChart from "@/components/channel/SeriesChart";
import { Chip, DecisionBadge, Empty, ErrorNote, PageHeader, Panel } from "@/components/shell/primitives";

const PROBES: [string, ChannelIn][] = [
  ["Honest", {}],
  ["Noisy (3%)", { depolarizing: 0.03 }],
  ["Stealth probe: 5% in Z", { intercept_fraction: 0.05, eve_bases: [0] }],
  ["Probe 20% in X", { intercept_fraction: 0.2, eve_bases: [1] }],
  ["Random-basis intercept 30%", { intercept_fraction: 0.3 }],
  ["Entangle-and-measure 50% (Y)", { entangle_fraction: 0.5, entangle_basis: 2 }],
];

function Probes() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const probe = useMutation({
    mutationFn: async (channel: ChannelIn) => api.verify(await api.sign(`probe ${Date.now()}`), "bob", channel),
    onSuccess: () => qc.invalidateQueries(),
  });
  const d4 = probe.data?.results.find((r) => r.detector === "D4");
  return (
    <Panel title="Send a signature through a chosen channel" code="alice → bob · POST /sign + /verify">
      <div className="flex flex-wrap gap-2">
        {PROBES.map(([label, ch]) => (
          <button key={label} className={Object.keys(ch).length ? "btn-ghost" : "btn-primary"} disabled={probe.isPending || replay} onClick={() => probe.mutate(ch)}>{label}</button>
        ))}
      </div>
      {probe.error && <div className="mt-3"><ErrorNote error={probe.error} /></div>}
      {probe.data && d4 && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-paper-dim">
          <DecisionBadge decision={probe.data.decision} /> QBER <b className="data text-paper">{pct(d4.extra.qber, 2)}</b> · fingerprint:
          <span className="text-amber-hot">{d4.extra.fingerprint.label}</span>
          {d4.extra.fingerprint.est_intercept_fraction !== null && <> · estimated size <b className="text-paper">{pct(d4.extra.fingerprint.est_intercept_fraction)}</b></>}
        </p>
      )}
    </Panel>
  );
}

export default function ChannelObservatory() {
  const links = useLinks(200);
  const names = Object.keys(links.data ?? {});
  const [sel, setSel] = useState<string | null>(null);
  const name = sel && names.includes(sel) ? sel : names[0];
  const l = name ? links.data?.[name] : undefined;
  const base = l ? baselineRates(l) : null;
  const series = (l?.history ?? []).map((h, i) => ({ i: i + 1, qber: h.qber, chsh: h.chsh, cusum: h.cusum }));
  const rates = l?.latest?.rates ?? null;
  const axes = ellipsoidAxes(rates);
  const shape = ellipsoidShape(rates);

  return (
    <div>
      <PageHeader directive="Directive 05 · D3 & D4 forensics" title="Channel Observatory"
        lede="Every honest signature doubles as channel tomography. A Pauli channel squeezes the Bloch sphere into an ellipsoid whose semi-axes are exactly 1 − 2·(error rate) in each basis — so its shape tells you how the eavesdropper is listening." />
      {links.error && <div className="mb-5"><ErrorNote error={links.error} /></div>}
      <div className="mb-5"><Probes /></div>
      {!l || !base ? <Empty>No link yet — send an honest signature above.</Empty> : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {names.map((n) => (
              <button key={n} onClick={() => setSel(n)} className={`chip !px-3 !py-1 ${n === name ? "border-amber text-amber" : "border-paper-mute/40 text-paper-faint"}`}>
                <span className="data normal-case tracking-normal">{n}</span> · {links.data?.[n].status}
              </button>
            ))}
          </div>
          <div className="mb-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <Panel title="Armillary ellipsoid" code={name} bodyClass="p-0"
              actions={<Chip tone={l.status === "critical" ? "bad" : l.status === "warning" ? "warn" : "ok"}>{shape} · {l.status}</Chip>}>
              <div className="blueprint relative rounded-b-[10px]">
                <ChannelEllipsoid rates={rates} baseline={base} excess={l.latest?.excess_pauli} alarm={l.status === "critical"} height={420} />
                <div className="pointer-events-none absolute bottom-3 left-4 right-4 font-type text-[11px] text-paper-faint">
                  Ghost = frozen baseline · glowing axis = the basis Eve is probing · Z sky, X violet, Y green · drag to orbit
                </div>
              </div>
              <p className={`px-5 py-3 text-[12.5px] ${l.latest?.fingerprint_drift ? "text-amber-hot" : "text-accept"}`}>{l.latest?.fingerprint ?? "no verifications yet"}</p>
            </Panel>
            <div className="min-w-0 space-y-5">
              <Panel title="Semi-axes" code="1 − 2·rate (exact)">
                <table className="w-full text-[12.5px]">
                  <thead><tr className="label"><th className="py-1 text-left font-normal">Basis</th><th className="text-right font-normal">Error rate</th><th className="text-right font-normal">Axis</th></tr></thead>
                  <tbody>
                    {(["X", "Y", "Z"] as const).map((k) => (
                      <tr key={k} className="border-t hair">
                        <td className="py-2 font-label uppercase tracking-[.2em] text-paper">{k}</td>
                        <td className="data text-right text-paper-dim">{rates ? rates[k].toFixed(4) : "–"}</td>
                        <td className="data text-right text-amber">{rates ? axes[k.toLowerCase() as "x"].toFixed(4) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
              <Panel title="Frozen baseline (sealed)" code="on the ledger">
                <p className="mb-2 font-type text-[11px] text-paper-faint">Measured at commissioning ({l.baseline.pairs.toLocaleString()} Bell pairs), recorded on the ledger, never adapted by traffic — so a slow attacker can't drag “normal” along with her.</p>
                <dl className="grid grid-cols-2 gap-y-1.5 text-[12px]">
                  <dt className="label self-center">QBER</dt><dd className="data text-paper">{pct(l.baseline.qber, 2)}</dd>
                  <dt className="label self-center">error Z / X / Y</dt><dd className="data text-paper-dim">{pct(base.Z, 2)} / {pct(base.X, 2)} / {pct(base.Y, 2)}</dd>
                  <dt className="label self-center">CHSH</dt><dd className="data text-paper">{chsh(l.baseline.correlators.ZZ, l.baseline.correlators.XX).toFixed(3)}</dd>
                  <dt className="label self-center">verifications</dt><dd className="data text-paper">{l.verifications}</dd>
                  <dt className="label self-center">CUSUM alarms</dt><dd className="data text-paper">{l.cusum_alarms}</dd>
                </dl>
              </Panel>
              <Panel title="Pauli fingerprint" code="latest vs baseline">
                {l.latest?.pauli ? (
                  <div className="space-y-2">
                    {(["pX", "pY", "pZ"] as const).map((k) => {
                      const now = l.latest!.pauli![k];
                      const was = pauliOf(base)[k];
                      const max = Math.max(0.05, now, was);
                      return (
                        <div key={k} className="text-[11px]">
                          <div className="flex justify-between text-paper-dim"><span>{k} (Eve along {k.slice(1)})</span><span className="data">{pct(now, 2)} (was {pct(was, 2)})</span></div>
                          <div className="relative mt-1 h-3 rounded-sm bg-ink-700">
                            <div className="absolute h-3 rounded-sm bg-paper-mute/50" style={{ width: `${(was / max) * 100}%` }} />
                            <div className="relative h-3 rounded-sm bg-rust" style={{ width: `${(now / max) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-[12px] text-paper-dim">Estimated intercepted fraction ≈ <b className="text-paper">{pct(l.latest.est_intercept_fraction)}</b></p>
                  </div>
                ) : <Empty>Needs all three bases (six-state mode).</Empty>}
              </Panel>
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-3">
            <Panel title="QBER per verification"><SeriesChart data={series} lines={[{ key: "qber", name: "QBER", color: "#38bdf8" }]} refs={[{ y: 0.11, label: "alarm 11%", color: "#e0513a" }, { y: l.baseline.qber, label: "baseline", color: "#8a7c62" }]} /></Panel>
            <Panel title="CHSH entanglement score"><SeriesChart data={series} domain={[0, 3]} lines={[{ key: "chsh", name: "S", color: "#ffc15e" }]} refs={[{ y: 2, label: "classical limit", color: "#e0513a" }, { y: 2.83, label: "perfect", color: "#7fb8a4" }]} /></Panel>
            <Panel title="CUSUM running total"><SeriesChart data={series} lines={[{ key: "cusum", name: "CUSUM", color: "#c8502a" }]} refs={[{ y: 0.03, label: "alarm", color: "#e0513a" }]} /></Panel>
          </div>
        </>
      )}
    </div>
  );
}
