// One page that IS the proof (docs/frontend-spec.md §4.4).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, errorText } from "../api/client";
import type { Verdict } from "../api/types";
import { BlockHeatmap, BsmBars, CertificateExport, ChshGauge, DetectorCard, FingerprintPanel, MerkleLadder } from "../components/VerdictParts";
import { Button, Card, DecisionPill, Empty, ErrorNote, Pill } from "../components/ui";
import { classOfVerdict } from "../lib/attribution";
import { ago, pct, sci } from "../lib/physics";

function RecentList() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["verdicts"], queryFn: () => api.verdicts(100), refetchInterval: 3000 });
  return (
    <Card title="Recent verdicts">
      {q.error && <ErrorNote error={q.error} />}
      {q.data?.length ? (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-400"><tr><th>#</th><th>when</th><th>decision</th><th>link</th><th>alerts</th></tr></thead>
          <tbody>
            {q.data.map((v) => (
              <tr key={v.ledger_index} className="cursor-pointer border-t border-slate-800 hover:bg-slate-800/50" onClick={() => navigate(`/verdicts/${v.ledger_index}`)}>
                <td className="py-1 font-mono">{v.ledger_index}</td><td className="text-xs text-slate-400">{ago(v.issued_at)}</td>
                <td><DecisionPill decision={v.decision} /></td><td className="font-mono text-xs">{v.link}{v.transferred && " (forwarded)"}</td>
                <td className="flex flex-wrap gap-1 py-1">{v.alerts.map((a) => <Pill key={a.detector} tone={a.severity === "critical" ? "bad" : "warn"}>{a.detector}</Pill>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <Empty>No verdicts yet.</Empty>}
    </Card>
  );
}

function Proof({ v }: { v: Verdict }) {
  const qc = useQueryClient();
  const idx = v.certificate.ledger_index;
  const proof = useQuery({ queryKey: ["proof", idx], queryFn: () => api.proof(idx), enabled: v.certificate.merkle_proof === "pending", retry: false });
  const anchor = useMutation({ mutationFn: api.anchor, onSuccess: () => qc.invalidateQueries({ queryKey: ["proof", idx] }) });
  const p = v.certificate.merkle_proof !== "pending" ? v.certificate.merkle_proof : proof.data;
  return (
    <Card title="Ledger entry and Merkle proof">
      <p className="text-sm">Entry <b>#{idx}</b> · hash <span className="font-mono text-xs">{v.certificate.ledger_entry_hash}</span></p>
      <p className="mb-3 text-xs text-slate-400">Signed with ML-DSA-65; chained to the previous entry. Every 8 verdicts are anchored under one Merkle root.</p>
      {p ? <MerkleLadder proof={p} /> : (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Pill tone="warn">pending anchor</Pill>
          <Button variant="ghost" disabled={anchor.isPending} onClick={() => anchor.mutate()}>Anchor now (admin)</Button>
          {anchor.error && <span className="text-rose-300">{errorText(anchor.error)}</span>}
        </div>
      )}
    </Card>
  );
}

export default function VerdictInspector() {
  const { idx } = useParams();
  const index = idx !== undefined ? Number(idx) : undefined;
  const q = useQuery({ queryKey: ["verdict", index], queryFn: () => api.verdict(index as number), enabled: index !== undefined });
  const audit = useQuery({ queryKey: ["audit"], queryFn: api.audit });
  if (index === undefined) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Verdict Inspector</h1>
        <RecentList />
      </div>
    );
  }
  const v = q.data;
  const r = (d: string) => v?.results.find((x) => x.detector === d);
  const disputed = new Set(audit.data?.disputes.map((d) => d.key_id) ?? []);
  const cls = v && classOfVerdict(v, disputed);
  return (
    <div className="space-y-4">
      <Link to="/verdicts" className="text-sm text-cyan-300 underline">← all verdicts</Link>
      {q.error && <ErrorNote error={q.error} />}
      {v && cls && (
        <>
          <div className={`rounded-xl border p-5 ${v.decision === "ACCEPT" ? "border-emerald-700 bg-emerald-950/30" : "border-rose-700 bg-rose-950/30"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{v.decision}</h1>
              <Pill tone={cls.tone}>{cls.label}</Pill>
              <span className="font-mono text-sm text-slate-300">{v.certificate.link}</span>
              {v.certificate.protocol.transferred && <Pill tone="info">forwarded (τ = {v.certificate.protocol.tau_applied})</Pill>}
              <Pill tone="ok" className="ml-auto">AI in trust path: {v.certificate.ai_in_trust_path ? "YES" : "NO"}</Pill>
            </div>
            <p className="mt-2 text-sm text-slate-300">
              A forger passes one block with probability <b>{sci(v.certificate.forgery_exact_per_block)}</b> (exact) ≤ {sci(v.certificate.forgery_bound_per_block)} (Chernoff) ·
              {" "}τ = {v.certificate.protocol.tau_applied} · {v.certificate.protocol.basis_set} · L = {v.certificate.protocol.hash_bits}, n = {v.certificate.protocol.rounds_per_bit}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {r("D1") && <DetectorCard r={r("D1")!} />}
            {r("D2") && (
              <DetectorCard r={r("D2")!}>
                <BlockHeatmap mismatches={v.certificate.transcript.block_mismatches} limit={r("D2")!.threshold ?? 0} failed={r("D2")!.extra.failed_blocks ?? []} />
              </DetectorCard>
            )}
            {r("D3") && <DetectorCard r={r("D3")!}>{r("D3")!.extra.chsh !== undefined && <ChshGauge s={r("D3")!.extra.chsh} fidelity={r("D3")!.extra.fidelity} />}</DetectorCard>}
            {r("D4") && (
              <DetectorCard r={r("D4")!}>
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">QBER {pct(r("D4")!.extra.qber, 2)} · SPRT: {r("D4")!.extra.sprt_decision} after {r("D4")!.extra.sprt_rounds} rounds · CUSUM {Number(r("D4")!.extra.cusum).toFixed(3)} / 0.03</p>
                  <FingerprintPanel fp={r("D4")!.extra.fingerprint} />
                  <BsmBars counts={r("D4")!.extra.bsm_counts} />
                </div>
              </DetectorCard>
            )}
            {r("D5") && <DetectorCard r={r("D5")!} />}
            {r("D6") && <DetectorCard r={r("D6")!}>{r("D6")!.extra.honeypot && <p className="font-semibold text-rose-300">Physically valid signature – caught by a honeypot key.</p>}</DetectorCard>}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Transcript">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-400">signer / key</dt><dd className="font-mono text-xs">{v.certificate.signature.signer_id} / {v.certificate.signature.key_id}</dd>
                <dt className="text-slate-400">verifier</dt><dd>{v.certificate.transcript.verifier_id}</dd>
                <dt className="text-slate-400">nonce / counter</dt><dd className="font-mono text-xs">{v.certificate.signature.nonce} / {v.certificate.signature.counter}</dd>
                <dt className="text-slate-400">rounds / QBER</dt><dd>{v.certificate.transcript.total_rounds.toLocaleString()} / {pct(v.certificate.transcript.qber, 2)}</dd>
                <dt className="text-slate-400">digest</dt><dd className="break-all font-mono text-xs">{v.certificate.transcript.digest_hex}</dd>
                <dt className="text-slate-400">transcript hash</dt><dd className="break-all font-mono text-xs">{v.certificate.transcript_hash}</dd>
                <dt className="text-slate-400">backend / seed</dt><dd className="font-mono text-xs">{v.certificate.transcript.backend} / {v.certificate.transcript.seed}</dd>
              </dl>
            </Card>
            <Proof v={v} />
          </div>
          <Card title="Export"><CertificateExport verdict={v} /></Card>
        </>
      )}
    </div>
  );
}
