// Red-team console (docs/frontend-spec.md §4.3): launch, sweep, campaign.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorText } from "../api/client";
import type { AttackRun, SweepRow } from "../api/types";
import SeriesChart from "../components/SeriesChart";
import { InfoMeter } from "../components/VerdictParts";
import { Button, Card, DecisionPill, ErrorNote, Pill, Slider } from "../components/ui";
import { classOfVerdict } from "../lib/attribution";
import { pct } from "../lib/physics";
import { useSession } from "../state/session";

// Mirrors qsentinel/attacks/campaigns/smoke.yaml
const CAMPAIGN: { attack: string; strength?: number; noise?: number }[] = [
  { attack: "honest" }, { attack: "honest", noise: 0.03 }, { attack: "blind_forgery" }, { attack: "known_basis_partial_forgery" },
  { attack: "intercept_resend" }, { attack: "intercept_resend", strength: 0.5 }, { attack: "entangle_and_measure" },
  { attack: "stealth_probe" }, { attack: "stealth_probe", noise: 0.03 }, { attack: "replay" }, { attack: "key_reuse_forgery" },
  { attack: "mitm_message_swap" }, { attack: "repudiation" }, { attack: "repudiation_unprotected" }, { attack: "impersonation" },
  { attack: "unauthorised_verification" }, { attack: "stolen_key_honeypot" },
];

function RunResult({ run }: { run: AttackRun }) {
  const cls = classOfVerdict(run.verdict);
  return (
    <Card title={<span>{run.attack} <span className="text-slate-400">@ {pct(run.strength, 0)}</span></span>}
      right={<div className="flex gap-2"><Pill tone={run.result === "PASS" ? "ok" : "bad"}>{run.result === "PASS" ? "caught as expected" : "NOT as expected"}</Pill><DecisionPill decision={run.decision} /></div>}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Pill tone={cls.tone}>{cls.label}</Pill>
        <span className="text-slate-400">fired: <b className="text-slate-200">{run.fired}</b> · expected: {run.expected}</span>
      </div>
      <p className="mt-2 text-sm text-slate-300">{run.detail}</p>
      {run.metrics.bob && (
        <p className="mt-2 text-sm">Bob (direct): <DecisionPill decision={run.metrics.bob} /> · Charlie (forwarded): <DecisionPill decision={run.metrics.charlie} /></p>
      )}
      <div className="mt-3"><InfoMeter metrics={run.metrics} /></div>
      <Link className="mt-3 inline-block text-sm text-cyan-300 underline" to={`/verdicts/${run.verdict.certificate.ledger_index}`}>Open proof certificate #{run.verdict.certificate.ledger_index} →</Link>
    </Card>
  );
}

function Launch() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const attacks = useQuery({ queryKey: ["attacks"], queryFn: api.attacks });
  const [name, setName] = useState("intercept_resend");
  const [strength, setStrength] = useState(1);
  const [noise, setNoise] = useState(0);
  const [seed, setSeed] = useState("");
  const run = useMutation({
    mutationFn: () => api.runAttack({ attack: name, strength, seed: seed ? Number(seed) : undefined, channel: { depolarizing: noise } }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const pick = (n: string, s: number) => { setName(n); setStrength(s); };
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Attack library" className="xl:col-span-2">
        {attacks.error && <ErrorNote error={attacks.error} />}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attacks.data?.map((a) => (
            <button key={a.name} onClick={() => pick(a.name, a.default_strength)}
              className={`rounded-lg border p-3 text-left text-sm transition ${name === a.name ? "border-cyan-500 bg-cyan-950/40" : "border-slate-800 hover:bg-slate-800/60"}`}>
              <p className="font-semibold">{a.name.replaceAll("_", " ")}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{a.description || "control: an honest signature"}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {a.detectors.map((d) => <Pill key={d} tone="info">{d}</Pill>)}
                {a.expected === "ACCEPT" && !a.detectors.length && <Pill tone="ok">must ACCEPT</Pill>}
                {a.expected === "-" && !a.detectors.length && <Pill tone="ok">verifiers must agree</Pill>}
              </div>
            </button>
          ))}
        </div>
      </Card>
      <div className="space-y-4">
        <Card title={`Launch: ${name.replaceAll("_", " ")}`}>
          <div className="space-y-3">
            <Slider label="Adversary strength" value={strength} onChange={setStrength} format={(v) => pct(v, 0)} />
            <Slider label="Honest channel noise (depolarising)" value={noise} onChange={setNoise} max={0.1} step={0.005} format={(v) => pct(v, 1)} />
            <label className="block text-sm text-slate-300">Seed (optional, for bit-for-bit reproducibility)
              <input className="mt-1 w-full rounded-lg bg-slate-800 p-2 font-mono" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))} placeholder="random" />
            </label>
            <Button variant="danger" className="w-full" disabled={run.isPending || replay} onClick={() => run.mutate()}>{run.isPending ? "Running…" : "Launch attack"}</Button>
            {run.error && <p className="text-sm text-rose-300">{errorText(run.error)}</p>}
          </div>
        </Card>
        {run.data && <RunResult run={run.data} />}
      </div>
    </div>
  );
}

function Sweep() {
  const attacks = useQuery({ queryKey: ["attacks"], queryFn: api.attacks });
  const [name, setName] = useState("stealth_probe");
  const [max, setMax] = useState(0.2);
  const [noise, setNoise] = useState(0.03);
  const [trials, setTrials] = useState(4);
  const sweep = useMutation({ mutationFn: () => api.sweep({ attack: name, min: 0, max, steps: 6, trials, noise }) });
  const rows: SweepRow[] = sweep.data ?? [];
  const data = rows.map((r) => ({ i: pct(r.strength, 0), reject: r.reject_rate, alert: r.alert_rate, D3: r.D3_rate, D4: r.D4_rate }));
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Detection rate vs attack strength">
        <div className="space-y-3">
          <select className="w-full rounded-lg bg-slate-800 p-2 text-sm" value={name} onChange={(e) => setName(e.target.value)}>
            {attacks.data?.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
          <Slider label="Maximum strength" value={max} onChange={setMax} min={0.05} format={(v) => pct(v, 0)} />
          <Slider label="Honest noise" value={noise} onChange={setNoise} max={0.1} step={0.005} format={(v) => pct(v, 1)} />
          <Slider label="Trials per step" value={trials} onChange={setTrials} min={1} max={10} step={1} />
          <Button className="w-full" disabled={sweep.isPending} onClick={() => sweep.mutate()}>{sweep.isPending ? "Sweeping… (fresh test system)" : "Run sweep"}</Button>
          {sweep.error && <p className="text-sm text-rose-300">{errorText(sweep.error)}</p>}
          <p className="text-xs text-slate-500">Runs on a throw-away system, never the live ledger. Strength 0 = the false-alarm rate.</p>
        </div>
      </Card>
      <Card title="Result" className="xl:col-span-2">
        {rows.length ? (
          <>
            <SeriesChart data={data} domain={[0, 1]} height={260} lines={[
              { key: "alert", name: "any alert", color: "#fbbf24" }, { key: "reject", name: "rejected", color: "#fb7185" },
              { key: "D3", name: "D3 fired", color: "#a78bfa" }, { key: "D4", name: "D4 fired", color: "#22d3ee" }]} />
            <table className="mt-3 w-full text-left text-xs">
              <thead className="text-slate-400"><tr><th>strength</th><th>alert</th><th>reject</th><th>mean QBER</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.strength} className="border-t border-slate-800"><td>{pct(r.strength, 0)}</td><td>{pct(r.alert_rate, 0)}</td><td>{pct(r.reject_rate, 0)}</td><td>{pct(r.mean_qber)}</td></tr>)}</tbody>
            </table>
          </>
        ) : <p className="text-sm text-slate-500">Pick an attack and run a sweep.</p>}
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
    <Card title="Campaign (same 17 scenarios as CI)" right={rows.length > 0 && <Pill tone={passed === rows.length ? "ok" : "bad"}>{passed}/{rows.length} passed</Pill>}>
      <Button disabled={busy || replay} onClick={start}>{busy ? `Running ${rows.length + 1}/${CAMPAIGN.length}…` : "Run campaign"}</Button>
      <p className="mt-2 text-xs text-slate-500">Runs on the live system. Links keep the “normal” frozen at their first use, so a noisy run on a link commissioned clean correctly raises channel warnings (CI starts each run on a fresh system).</p>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-xs text-slate-400"><tr><th>result</th><th>attack</th><th>decision</th><th>fired</th><th>detail</th></tr></thead>
        <tbody>
          {rows.map((r, i) => "error" in r ? (
            <tr key={i} className="border-t border-slate-800"><td><Pill tone="bad">ERROR</Pill></td><td>{r.attack}</td><td colSpan={3}>{r.error}</td></tr>
          ) : (
            <tr key={i} className="border-t border-slate-800 align-top">
              <td className="py-1"><Pill tone={r.result === "PASS" ? "ok" : "bad"}>{r.result}</Pill></td>
              <td><Link className="text-cyan-300 underline" to={`/verdicts/${r.verdict.certificate.ledger_index}`}>{r.attack}</Link></td>
              <td><DecisionPill decision={r.decision} /></td><td className="font-mono text-xs">{r.fired}</td>
              <td className="text-xs text-slate-400">{r.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export default function AttackLab() {
  const [tab, setTab] = useState<"launch" | "sweep" | "campaign">("launch");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Attack Lab</h1>
        <p className="text-sm text-slate-400">Our own practice hacker. Every attack declares which alarm must catch it.</p>
      </div>
      <div className="flex gap-2">
        {(["launch", "sweep", "campaign"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1 text-sm capitalize ${tab === t ? "bg-cyan-700" : "bg-slate-800"}`}>{t}</button>
        ))}
      </div>
      {tab === "launch" ? <Launch /> : tab === "sweep" ? <Sweep /> : <Campaign />}
    </div>
  );
}
