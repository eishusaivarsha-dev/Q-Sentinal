// Red-team console (docs/frontend-spec.md §4.3): launch, sweep, campaign.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Crosshair, FlaskConical, ListChecks, Rocket, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, errorText } from "@/api/client";
import { useAttacks } from "@/api/hooks";
import type { AttackRun, SweepRow } from "@/api/types";
import { attackCopy } from "@/lib/attribution";
import { pct } from "@/lib/format";
import { useSession } from "@/state/session";
import SeriesChart from "@/components/charts";
import { to } from "@/components/shell/nav";
import { AttackIcon, Card, Chip, DecisionBadge, Empty, ErrorNote, PageHeader, Skeleton, Slider, Tabs, Toggle } from "@/components/ui";
import { AttackCard, RunResult } from "@/components/verdict/parts";

// Mirrors qsentinel/attacks/campaigns/smoke.yaml
const CAMPAIGN: { attack: string; strength?: number; noise?: number }[] = [
  { attack: "honest" }, { attack: "honest", noise: 0.03 }, { attack: "blind_forgery" }, { attack: "known_basis_partial_forgery" },
  { attack: "intercept_resend" }, { attack: "intercept_resend", strength: 0.5 }, { attack: "entangle_and_measure" },
  { attack: "stealth_probe" }, { attack: "stealth_probe", noise: 0.03 }, { attack: "replay" }, { attack: "key_reuse_forgery" },
  { attack: "mitm_message_swap" }, { attack: "repudiation" }, { attack: "repudiation_unprotected" }, { attack: "impersonation" },
  { attack: "unauthorised_verification" }, { attack: "stolen_key_honeypot" },
];

function Launch() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const attacks = useAttacks();
  const [params] = useSearchParams();
  const [name, setName] = useState(params.get("a") ?? "intercept_resend");
  const [strength, setStrength] = useState(1);
  const [noise, setNoise] = useState(0);
  const [seed, setSeed] = useState("");
  const [armed, setArmed] = useState(false);
  const run = useMutation({
    mutationFn: () => api.runAttack({ attack: name, strength, seed: seed ? Number(seed) : undefined, channel: { depolarizing: noise } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const info = attacks.data?.find((a) => a.name === name);
  const copy = attackCopy(name);
  const pick = (n: string, s: number) => { setName(n); setStrength(s); run.reset(); };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
      <Card title="Attack library" sub={attacks.data ? `${attacks.data.length} scenarios · GET /attacks` : "loading"} icon={FlaskConical}>
        {attacks.error && <ErrorNote error={attacks.error} />}
        {!attacks.data && !attacks.error && <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-24" />)}</div>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {attacks.data?.map((a) => <AttackCard key={a.name} a={a} selected={name === a.name} onPick={() => pick(a.name, a.default_strength)} />)}
        </div>
      </Card>
      <div className="min-w-0 space-y-6">
        <Card glow title="Launch console" sub="arm the safety, then launch" icon={Rocket}>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <AttackIcon glyph={copy.glyph} size={60} tone="bad" />
              <div className="min-w-0">
                <div className="data text-[13px] text-ink-3">{copy.code} · {name}</div>
                <h3 className="text-[26px] font-extrabold leading-tight text-ink">{copy.label}</h3>
                <p className="mt-1 text-[15px] text-ink-2">{info?.description || copy.oneLiner}</p>
              </div>
            </div>
            {info && (
              <div className="rounded-2xl border border-line bg-surface-2 p-4">
                <div className="label mb-2 !text-[12px]">Must be caught by</div>
                <div className="flex flex-wrap items-center gap-2">
                  {info.detectors.length ? info.detectors.map((d) => <Chip key={d} tone="info" className="data">{d}</Chip>) : <Chip tone="ok">nothing: must {info.expected === "ACCEPT" ? "ACCEPT" : "keep verifiers consistent"}</Chip>}
                  <span className="text-[14px] text-ink-3">expected decision <b className="text-ink">{info.expected}</b></span>
                </div>
              </div>
            )}
            <Slider label="Adversary strength" value={strength} onChange={setStrength} format={(v) => pct(v, 0)} />
            <Slider label="Honest channel noise (depolarising)" value={noise} onChange={setNoise} max={0.1} step={0.005} format={(v) => pct(v, 1)} />
            <label className="block">
              <span className="text-[15px] font-semibold text-ink-2">Seed (optional · bit-for-bit reproducible)</span>
              <input className="field mt-2" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))} placeholder="random" inputMode="numeric" />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
              <Toggle on={armed} onChange={setArmed} label="Safety off" sub="required before launch" />
              <motion.button whileTap={{ scale: 0.96 }} className="btn-danger min-w-[190px] !py-3 !text-[16px]" disabled={!armed || run.isPending || replay}
                onClick={() => { run.mutate(); setArmed(false); }}>
                <Crosshair size={18} /> {run.isPending ? "Transmitting…" : "Launch attack"}
              </motion.button>
            </div>
            {run.error && <ErrorNote error={run.error} />}
          </div>
        </Card>
        {run.data ? <RunResult run={run.data} /> : (
          <Card title="Result" sub="awaiting launch" icon={ShieldCheck}>
            <Empty>{run.isPending ? "Photons in flight…" : "Pick an attack, arm the safety and launch. The verdict comes from the verifier, not this page."}</Empty>
          </Card>
        )}
      </div>
    </div>
  );
}

function Sweep() {
  const attacks = useAttacks();
  const [name, setName] = useState("stealth_probe");
  const [max, setMax] = useState(0.2);
  const [noise, setNoise] = useState(0.03);
  const [trials, setTrials] = useState(4);
  const sweep = useMutation({ mutationFn: () => api.sweep({ attack: name, min: 0, max, steps: 6, trials, noise }) });
  const rows: SweepRow[] = sweep.data ?? [];
  const data = rows.map((r) => ({ i: pct(r.strength, 0), reject: r.reject_rate, alert: r.alert_rate, D3: r.D3_rate, D4: r.D4_rate }));
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_2fr]">
      <Card title="Detection rate vs strength" sub="POST /sweeps · throw-away system" icon={FlaskConical}>
        <div className="space-y-5">
          <select className="field" value={name} onChange={(e) => setName(e.target.value)}>
            {attacks.data?.map((a) => <option key={a.name} value={a.name}>{attackCopy(a.name).label}</option>)}
          </select>
          <Slider label="Maximum strength" value={max} onChange={setMax} min={0.05} format={(v) => pct(v, 0)} />
          <Slider label="Honest noise" value={noise} onChange={setNoise} max={0.1} step={0.005} format={(v) => pct(v, 1)} />
          <Slider label="Trials per step" value={trials} onChange={setTrials} min={1} max={10} step={1} />
          <button className="btn-primary w-full" disabled={sweep.isPending} onClick={() => sweep.mutate()}>{sweep.isPending ? "Sweeping…" : "Run sweep"}</button>
          {sweep.error && <ErrorNote error={sweep.error} />}
          <p className="text-[14px] text-ink-3">Never touches the live ledger. Strength 0 = the false-alarm rate.</p>
        </div>
      </Card>
      <Card title="Result" sub={rows.length ? `${rows.length} strengths` : "run a sweep"}>
        {rows.length ? (
          <>
            <SeriesChart data={data} domain={[0, 1]} height={300} area lines={[
              { key: "alert", name: "any alert", token: "warn" }, { key: "reject", name: "rejected", token: "bad" },
              { key: "D3", name: "D3 fired", token: "violet" }, { key: "D4", name: "D4 fired", token: "brand-2" }]} />
            <table className="mt-4 w-full text-left text-[14px]">
              <thead className="label !text-[12px]"><tr><th className="py-2">strength</th><th>alert</th><th>reject</th><th>mean QBER</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.strength} className="data border-t border-line"><td className="py-2">{pct(r.strength, 0)}</td><td>{pct(r.alert_rate, 0)}</td><td>{pct(r.reject_rate, 0)}</td><td>{pct(r.mean_qber)}</td></tr>)}</tbody>
            </table>
          </>
        ) : <Empty>Pick an attack and run a sweep.</Empty>}
      </Card>
    </div>
  );
}

function Campaign() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const [rows, setRows] = useState<(AttackRun | { attack: string; error: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    setRows([]);
    for (const [i, c] of CAMPAIGN.entries()) {
      try {
        const r = await api.runAttack({ attack: c.attack, strength: c.strength ?? null, seed: 42 + i, channel: { depolarizing: c.noise ?? 0 } });
        setRows((prev) => [...prev, r]);
      } catch (e) {
        setRows((prev) => [...prev, { attack: c.attack, error: errorText(e) }]);
      }
    }
    setBusy(false);
    qc.invalidateQueries();
  };
  const passed = rows.filter((r) => "result" in r && r.result === "PASS").length;
  return (
    <Card title="Campaign" sub="the same 17 scenarios CI runs" icon={ListChecks}
      actions={rows.length > 0 && <Chip tone={passed === rows.length ? "ok" : "bad"}>{passed}/{rows.length} passed</Chip>}>
      <div className="flex flex-wrap items-center gap-4">
        <button className="btn-danger" disabled={busy || replay} onClick={start}>{busy ? `Running ${rows.length + 1}/${CAMPAIGN.length}…` : "Run campaign"}</button>
        <div className="h-2 min-w-[200px] flex-1 overflow-hidden rounded-full bg-line"><motion.div className="h-full bg-ok" animate={{ width: `${(rows.length / CAMPAIGN.length) * 100}%` }} /></div>
      </div>
      <p className="mt-3 text-[14px] text-ink-3">Runs on the live system. Links keep the “normal” frozen at first use, so a noisy run on a link commissioned clean correctly raises channel warnings (CI starts each run on a fresh system).</p>
      <div className="mt-4 overflow-x-auto" data-lenis-prevent>
        <table className="w-full min-w-[640px] text-left text-[14px]">
          <thead className="label !text-[12px]"><tr><th className="py-2">result</th><th>attack</th><th>decision</th><th>fired</th><th>detail</th></tr></thead>
          <tbody>
            {rows.map((r, i) => "error" in r ? (
              <tr key={i} className="border-t border-line"><td className="py-2.5"><Chip tone="bad">error</Chip></td><td>{r.attack}</td><td colSpan={3} className="text-bad">{r.error}</td></tr>
            ) : (
              <motion.tr key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="border-t border-line align-top">
                <td className="py-2.5"><Chip tone={r.result === "PASS" ? "ok" : "bad"}>{r.result}</Chip></td>
                <td><Link className="link" to={to(`verdicts/${r.verdict.certificate.ledger_index}`)}>{attackCopy(r.attack).label}</Link></td>
                <td><DecisionBadge decision={r.decision} /></td><td className="data">{r.fired}</td>
                <td className="text-ink-3">{r.detail}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function AttackLab() {
  const [tab, setTab] = useState<"launch" | "sweep" | "campaign">("launch");
  return (
    <div>
      <PageHeader eyebrow="Operate · red team" title="Attack" accent="Lab"
        lede="Our own practice adversary. Every attack declares which detector must catch it; the verdict you see is issued by the verifier, not by this page."
        right={<Tabs value={tab} onChange={setTab} options={[["launch", "Launch"], ["sweep", "Sweep"], ["campaign", "Campaign"]]} />} />
      {tab === "launch" ? <Launch /> : tab === "sweep" ? <Sweep /> : <Campaign />}
    </div>
  );
}
