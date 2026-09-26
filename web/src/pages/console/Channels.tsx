// Channel Observatory (docs/frontend-spec.md §4.5): one quantum link, in depth. The 3-D ellipsoid
// is the channel itself - a Pauli channel squashes the Bloch sphere to semi-axes 1 - 2 x (error
// rate) per basis - drawn over the ghost of the frozen baseline. Its shape names the eavesdropper.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Lock, Radar, Send, Sigma, Waves } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "@/api/client";
import { useLinks } from "@/api/hooks";
import type { LinkStatus } from "@/api/types";
import { cn } from "@/lib/cn";
import { pct, sci } from "@/lib/format";
import { baselineRates, ellipsoidAxes, ellipsoidShape } from "@/lib/physics";
import { useSession } from "@/state/session";
import SeriesChart from "@/components/charts";
import { Card, Chip, DecisionBadge, Empty, ErrorNote, KeyVal, Meter, PageHeader, Skeleton, Slider, Tabs } from "@/components/ui";
import { FingerprintPanel } from "@/components/verdict/parts";

const BlochSphere = lazy(() => import("@/three/BlochSphere"));

function hotAxisOf(l: LinkStatus): "x" | "y" | "z" | null {
  const p = l.latest;
  if (!p?.fingerprint_drift) return null;
  const shape = ellipsoidShape(p.rates);
  return shape.endsWith("cigar") ? (shape[0].toLowerCase() as "x" | "y" | "z") : null;
}

function Probe({ link }: { link: string }) {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const [signer, verifier] = link.split("->");
  const [msg, setMsg] = useState("Transfer ₹25,00,000 to account 4471");
  const [noise, setNoise] = useState(0.01);
  const [eve, setEve] = useState(0);
  const [basis, setBasis] = useState<"all" | "0" | "1" | "2">("all");
  const run = useMutation({
    mutationFn: async () => {
      const sig = await api.sign(msg, signer);
      return api.verify(sig, verifier, { depolarizing: noise, intercept_fraction: eve, eve_bases: basis === "all" ? [0, 1, 2] : [Number(basis)] });
    },
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <Card title="Send a signature through a chosen channel" sub="POST /sign → POST /verify" icon={Send}>
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <label className="block">
            <span className="text-[15px] font-semibold text-ink-2">Message ({signer} signs)</span>
            <input className="field mt-2" value={msg} maxLength={200} onChange={(e) => setMsg(e.target.value)} />
          </label>
          <Slider label="Honest noise (depolarising)" value={noise} onChange={setNoise} max={0.1} step={0.005} format={(v) => pct(v, 1)} />
          <Slider label="Eve intercepts" value={eve} onChange={setEve} format={(v) => pct(v, 0)} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[15px] font-semibold text-ink-2">Eve measures in</span>
            <Tabs value={basis} onChange={setBasis} options={[["all", "any basis"], ["0", "Z"], ["1", "X"], ["2", "Y"]]} />
          </div>
          <button className="btn-primary" disabled={run.isPending || replay || !msg.trim()} onClick={() => run.mutate()}>
            <Send size={16} />{run.isPending ? "Teleporting…" : `Sign and send to ${verifier}`}
          </button>
          {run.error && <ErrorNote error={run.error} />}
        </div>
        <div className="rounded-2xl border border-line bg-surface-2 p-5">
          {run.data ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2"><DecisionBadge decision={run.data.decision} size="lg" /><Chip tone="neutral" className="data">#{run.data.certificate.ledger_index}</Chip></div>
              <p className="text-[15px] text-ink-2">QBER <b className="data text-ink">{pct(run.data.certificate.transcript.qber, 2)}</b> · forger's odds per block <b className="data text-ink">{sci(run.data.certificate.forgery_exact_per_block)}</b></p>
              <p className="text-[14px] text-ink-3">{run.data.certificate.channel_fingerprint}</p>
              <ul className="space-y-1 text-[14px]">
                {run.data.results.filter((r) => r.alert && r.severity !== "info").map((r) => (
                  <li key={r.detector} className={r.severity === "critical" ? "text-bad" : "text-warn"}><b className="data">{r.detector}</b> · {r.detail}</li>
                ))}
              </ul>
            </div>
          ) : <Empty icon={Waves}>Adjust the channel and send. The link's ellipsoid, charts and CUSUM update with the new verification.</Empty>}
        </div>
      </div>
    </Card>
  );
}

export default function Channels() {
  const loc = useLocation() as { state?: { link?: string } };
  const links = useLinks(100);
  const names = Object.keys(links.data ?? {});
  const [name, setName] = useState<string | undefined>(loc.state?.link);
  useEffect(() => { if (!name && names.length) setName(names[0]); }, [name, names]);
  const l = name ? links.data?.[name] : undefined;
  const latest = l?.latest;
  const axes = ellipsoidAxes(latest?.rates);
  const ghost = l ? ellipsoidAxes(baselineRates(l)) : null;
  const hot = l ? hotAxisOf(l) : null;
  const hist = (l?.history ?? []).map((h, i) => ({ i: i + 1, qber: h.qber, chsh: h.chsh, cusum: h.cusum, fid: h.fidelity }));
  const tone = l?.status === "critical" ? "bad" : l?.status === "warning" ? "warn" : l?.status === "healthy" ? "ok" : "neutral";

  return (
    <div>
      <PageHeader eyebrow="Observe · forensics" title="Channel" accent="Observatory"
        lede="Eavesdropping leaves errors, and which basis the errors hit reveals how she is listening. The ellipsoid is the channel: a perfect link is a sphere; an eavesdropper squashes it."
        right={names.length > 0 && (
          <select className="field !w-auto" value={name} onChange={(e) => setName(e.target.value)} aria-label="Choose link">
            {names.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )} />
      {links.error && <ErrorNote error={links.error} hint="Start the backend: uvicorn qsentinel.api.main:app --reload" />}
      {links.data && !names.length && <Empty icon={Radar}>No link commissioned yet. Send an honest signature from Mission Control first.</Empty>}
      {!links.data && !links.error && <Skeleton className="h-[520px]" />}
      {l && name && (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
            <section className={cn("card relative overflow-hidden", tone === "bad" && "!border-bad/35")}>
              <div className="absolute left-5 top-5 z-10 flex flex-wrap gap-2">
                <Chip tone={tone} dot>{l.status}</Chip>
                <span className="glass rounded-full px-3 py-1 text-[13px] font-semibold text-ink-2">{ellipsoidShape(latest?.rates)}</span>
                {hot && <Chip tone="bad">Eve probing the {hot.toUpperCase()} axis</Chip>}
              </div>
              <Suspense fallback={<Skeleton className="h-[480px] rounded-none" />}>
                <BlochSphere ellipsoid={axes} ghost={ghost} hotAxis={hot} alarm={l.status === "critical"} height={480} />
              </Suspense>
              <div className="absolute bottom-4 left-5 right-5 z-10 flex flex-wrap gap-2 text-[12.5px]">
                <span className="glass rounded-full px-2.5 py-1 text-ink-3">wireframe = frozen baseline · solid = latest verification · drag to orbit</span>
              </div>
            </section>
            <div className="min-w-0 space-y-6">
              <Card title="Semi-axes" sub="1 − 2 × error rate, per basis" icon={Sigma}>
                <div className="space-y-4">
                  {(["x", "y", "z"] as const).map((k) => (
                    <div key={k}>
                      <div className="mb-1 flex justify-between text-[14px]"><span className="font-semibold text-ink-2">{k.toUpperCase()} axis</span><span className="data text-ink">{axes[k].toFixed(3)} <span className="text-ink-3">/ baseline {ghost?.[k].toFixed(3)}</span></span></div>
                      <Meter value={Math.max(axes[k], 0)} tone={hot === k ? "bad" : axes[k] < 0.78 ? "warn" : "brand"} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card title="Pauli fingerprint" sub="G-test against the frozen baseline" icon={Activity}>
                {latest ? <FingerprintPanel fp={{
                  rates: latest.rates, baseline_rates: latest.baseline_rates, pauli: latest.pauli, excess_pauli: latest.excess_pauli,
                  g_stat: Number.NaN, p_value: Number.NaN, drift: latest.fingerprint_drift, label: latest.fingerprint,
                  est_intercept_fraction: latest.est_intercept_fraction,
                }} /> : <Empty>No verification on this link yet.</Empty>}
              </Card>
              <Card title="Frozen baseline" sub="sealed at commissioning" icon={Lock}>
                <KeyVal cols={2} items={[
                  ["Baseline QBER", pct(l.baseline.qber, 2)], ["Bell pairs", l.baseline.pairs.toLocaleString()],
                  ["⟨ZZ⟩ ⟨XX⟩ ⟨YY⟩", `${l.baseline.correlators.ZZ.toFixed(2)} ${l.baseline.correlators.XX.toFixed(2)} ${l.baseline.correlators.YY.toFixed(2)}`],
                  ["Verifications", `${l.verifications} · ${l.cusum_alarms} CUSUM alarms`],
                ]} />
              </Card>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <Card title="QBER per verification" sub="alarm at 11%" icon={Activity}>
              {hist.length > 1 ? <SeriesChart data={hist} lines={[{ key: "qber", name: "QBER", token: "brand" }]} refs={[{ y: 0.11, label: "11%" }]} area height={220} />
                : <Empty>Needs two verifications.</Empty>}
            </Card>
            <Card title="CHSH entanglement score" sub="classical limit S = 2" icon={Waves}>
              {hist.some((h) => h.chsh !== null) ? <SeriesChart data={hist} lines={[{ key: "chsh", name: "S", token: "violet" }]} refs={[{ y: 2, label: "S = 2" }, { y: 2 * Math.SQRT2, label: "2√2", token: "ok" }]} domain={[1.5, 3]} height={220} />
                : <Empty>No Bell data yet.</Empty>}
            </Card>
            <Card title="CUSUM running total" sub="slow, quiet probes add up" icon={Sigma}>
              {hist.length > 1 ? <SeriesChart data={hist} lines={[{ key: "cusum", name: "CUSUM", token: "warn" }]} refs={[{ y: 0.03, label: "alarm" }]} area height={220} />
                : <Empty>Needs two verifications.</Empty>}
            </Card>
          </div>

          <Probe link={name} />
        </div>
      )}
    </div>
  );
}
