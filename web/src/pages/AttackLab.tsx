// Red-team console (docs/frontend-spec.md §4.3): launch, sweep, campaign.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, errorText } from "@/api/client";
import { useAttacks } from "@/api/hooks";
import type { AttackRun, SweepRow } from "@/api/types";
import { attackCopy } from "@/lib/attribution";
import { pct } from "@/lib/format";
import { useSession } from "@/state/session";
import { AttackGlyph } from "@/components/art/AttackGlyph";
import { Toggle, VacuumTube } from "@/components/art/Instruments";
import { AttackCard, RunResult } from "@/components/attack/AttackParts";
import SeriesChart from "@/components/channel/SeriesChart";
import { Chip, DecisionBadge, Empty, ErrorNote, LinkText, PageHeader, Panel, Slider, Tabs } from "@/components/shell/primitives";

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
    <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
      <Panel title="Attack library" code={attacks.data ? `${attacks.data.length} scenarios · GET /attacks` : ""}>
        {attacks.error && <ErrorNote error={attacks.error} />}
        {!attacks.data && !attacks.error && <Empty>Opening the catalogue…</Empty>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {attacks.data?.map((a) => <AttackCard key={a.name} a={a} selected={name === a.name} onPick={() => pick(a.name, a.default_strength)} />)}
        </div>
      </Panel>
      <div className="min-w-0 space-y-5">
        <Panel title="Launch console" code="arming required">
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <AttackGlyph glyph={copy.glyph} size={72} hot />
              <div className="min-w-0">
                <div className="data text-[11px] text-paper-faint">{copy.code} · {name}</div>
                <h3 className="font-display text-[26px] leading-tight text-paper">{copy.label}</h3>
                <p className="text-[12.5px] text-paper-dim">{info?.description || copy.oneLiner}</p>
              </div>
            </div>
            {info && (
              <div className="rounded-md border hair bg-ink/40 p-3 text-[12px]">
                <div className="label mb-1">Must be caught by</div>
                <div className="flex flex-wrap gap-1.5">
                  {info.detectors.length ? info.detectors.map((d) => <Chip key={d} tone="info">{d}</Chip>) : <Chip tone="ok">nothing — must {info.expected === "ACCEPT" ? "ACCEPT" : "keep verifiers consistent"}</Chip>}
                  <span className="text-paper-faint">expected decision: <b className="text-paper">{info.expected}</b></span>
                </div>
              </div>
            )}
            <Slider label="Adversary strength" value={strength} onChange={setStrength} format={(v) => pct(v, 0)} />
            <Slider label="Honest channel noise (depolarising)" value={noise} onChange={setNoise} max={0.1} step={0.005} format={(v) => pct(v, 1)} />
            <label className="block">
              <span className="label">Seed (optional, bit-for-bit reproducible)</span>
              <input className="field mt-1" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, ""))} placeholder="random" inputMode="numeric" />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-4 border-t hair pt-4">
              <Toggle on={armed} onChange={setArmed} label="Safety" />
              <button className="btn-danger min-w-[180px]" disabled={!armed || run.isPending || replay}
                onClick={() => { run.mutate(); setArmed(false); }}>{run.isPending ? "Transmitting…" : "⚡ Launch attack"}</button>
            </div>
            {run.error && <ErrorNote error={run.error} />}
          </div>
        </Panel>
        {run.data ? <RunResult run={run.data} /> : (
          <Panel title="Result" code="awaiting launch">
            <div className="flex items-center gap-4"><VacuumTube level={run.isPending ? 1 : 0.15} width={34} /><Empty>{run.isPending ? "Photons in flight…" : "Arm the lever and launch."}</Empty></div>
          </Panel>
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
    <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
      <Panel title="Detection rate vs strength" code="POST /sweeps">
        <div className="space-y-4">
          <select className="field" value={name} onChange={(e) => setName(e.target.value)}>
            {attacks.data?.map((a) => <option key={a.name} value={a.name}>{attackCopy(a.name).label}</option>)}
          </select>
          <Slider label="Maximum strength" value={max} onChange={setMax} min={0.05} format={(v) => pct(v, 0)} />
          <Slider label="Honest noise" value={noise} onChange={setNoise} max={0.1} step={0.005} format={(v) => pct(v, 1)} />
          <Slider label="Trials per step" value={trials} onChange={setTrials} min={1} max={10} step={1} />
          <button className="btn-primary w-full" disabled={sweep.isPending} onClick={() => sweep.mutate()}>{sweep.isPending ? "Sweeping… (fresh test system)" : "Run sweep"}</button>
          {sweep.error && <ErrorNote error={sweep.error} />}
          <p className="font-type text-[11px] text-paper-faint">Runs on a throw-away system, never the live ledger. Strength 0 = the false-alarm rate.</p>
        </div>
      </Panel>
      <Panel title="Result" code={rows.length ? `${rows.length} strengths` : ""}>
        {rows.length ? (
          <>
            <SeriesChart data={data} domain={[0, 1]} height={260} lines={[
              { key: "alert", name: "any alert", color: "#ffc15e" }, { key: "reject", name: "rejected", color: "#e0513a" },
              { key: "D3", name: "D3 fired", color: "#a78bfa" }, { key: "D4", name: "D4 fired", color: "#7fb8a4" }]} />
            <table className="mt-3 w-full text-left text-[12px]">
              <thead className="label"><tr><th className="font-normal">strength</th><th className="font-normal">alert</th><th className="font-normal">reject</th><th className="font-normal">mean QBER</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.strength} className="data border-t hair"><td className="py-1">{pct(r.strength, 0)}</td><td>{pct(r.alert_rate, 0)}</td><td>{pct(r.reject_rate, 0)}</td><td>{pct(r.mean_qber)}</td></tr>)}</tbody>
            </table>
          </>
        ) : <Empty>Pick an attack and run a sweep.</Empty>}
      </Panel>
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
    <Panel title="Campaign" code="same 17 scenarios as CI" actions={rows.length > 0 && <Chip tone={passed === rows.length ? "ok" : "bad"}>{passed}/{rows.length} passed</Chip>}>
      <button className="btn-danger" disabled={busy || replay} onClick={start}>{busy ? `Running ${rows.length + 1}/${CAMPAIGN.length}…` : "Run campaign"}</button>
      <p className="mt-2 font-type text-[11px] text-paper-faint">Runs on the live system. Links keep the “normal” frozen at their first use, so a noisy run on a link commissioned clean correctly raises channel warnings (CI starts each run on a fresh system).</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[12px]">
          <thead className="label"><tr><th className="font-normal">result</th><th className="font-normal">attack</th><th className="font-normal">decision</th><th className="font-normal">fired</th><th className="font-normal">detail</th></tr></thead>
          <tbody>
            {rows.map((r, i) => "error" in r ? (
              <tr key={i} className="border-t hair"><td className="py-1.5"><Chip tone="bad">error</Chip></td><td>{r.attack}</td><td colSpan={3} className="text-reject">{r.error}</td></tr>
            ) : (
              <tr key={i} className="border-t hair align-top">
                <td className="py-1.5"><Chip tone={r.result === "PASS" ? "ok" : "bad"}>{r.result}</Chip></td>
                <td><Link to={`/verdicts/${r.verdict.certificate.ledger_index}`}><LinkText>{attackCopy(r.attack).label}</LinkText></Link></td>
                <td><DecisionBadge decision={r.decision} /></td><td className="data">{r.fired}</td>
                <td className="text-paper-faint">{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export default function AttackLab() {
  const [tab, setTab] = useState<"launch" | "sweep" | "campaign">("launch");
  return (
    <div>
      <PageHeader directive="Directive 03 · Red team" title="Attack Lab"
        lede="Our own practice adversary. Every attack declares which detector must catch it; the verdict below is issued by the verifier, not by this page."
        right={<Tabs value={tab} onChange={setTab} options={[["launch", "Launch"], ["sweep", "Sweep"], ["campaign", "Campaign"]]} />} />
      {tab === "launch" ? <Launch /> : tab === "sweep" ? <Sweep /> : <Campaign />}
    </div>
  );
}
