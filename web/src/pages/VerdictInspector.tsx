// One page that IS the proof (docs/frontend-spec.md §4.4).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { useDisputedKeys, useVerdict, useVerdictSummaries } from "@/api/hooks";
import type { Verdict } from "@/api/types";
import { classOfVerdict } from "@/lib/attribution";
import { ago, docket, pct, shortHash } from "@/lib/format";
import { useSession } from "@/state/session";
import { Chip, DecisionBadge, DetectorChip, Empty, ErrorNote, LinkText, PageHeader, Panel } from "@/components/shell/primitives";
import { ChshGauge } from "@/components/verdict/ChshGauge";
import { BlockHeatmap, BsmBars, CertificateExport, DetectorCard, FingerprintPanel, MerkleLadder, PunchCard, VerdictBanner } from "@/components/verdict/VerdictParts";

function RecentList() {
  const navigate = useNavigate();
  const q = useVerdictSummaries(100);
  return (
    <Panel title="Recent verdicts" code="GET /verdicts" bodyClass="p-0">
      {q.error && <div className="p-4"><ErrorNote error={q.error} /></div>}
      {q.data?.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[12px]">
            <thead className="label"><tr><th className="px-5 py-2 font-normal">Docket</th><th className="font-normal">When</th><th className="font-normal">Decision</th><th className="font-normal">Link</th><th className="font-normal">Alerts</th></tr></thead>
            <tbody>
              {q.data.map((v) => (
                <tr key={v.ledger_index} className="cursor-pointer border-t hair transition hover:bg-amber/[.04]" onClick={() => navigate(`/verdicts/${v.ledger_index}`)}>
                  <td className="data px-5 py-2 text-amber">{docket(v.ledger_index)}</td>
                  <td className="text-paper-faint">{ago(v.issued_at)}</td>
                  <td><DecisionBadge decision={v.decision} /></td>
                  <td className="data text-paper-dim">{v.link}{v.transferred && " (forwarded)"}</td>
                  <td><span className="flex flex-wrap gap-1 py-1">{v.alerts.map((a) => <DetectorChip key={a.detector} id={a.detector} severity={a.severity} />)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !q.error && <Empty>No verdicts yet.</Empty>}
    </Panel>
  );
}

function Proof({ v }: { v: Verdict }) {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const idx = v.certificate.ledger_index;
  const pending = v.certificate.merkle_proof === "pending";
  const proof = useQuery({ queryKey: ["proof", idx], queryFn: () => api.proof(idx), retry: false });
  const anchor = useMutation({ mutationFn: api.anchor, onSuccess: () => qc.invalidateQueries({ queryKey: ["proof", idx] }) });
  const p = proof.data ?? (!pending ? (v.certificate.merkle_proof as Exclude<typeof v.certificate.merkle_proof, "pending">) : undefined);
  return (
    <Panel title="Ledger & Merkle proof" code={`entry #${idx}`}>
      <p className="text-[12px] text-paper-dim">Hash <span className="data break-all text-paper">{shortHash(v.certificate.ledger_entry_hash, 16)}</span></p>
      <p className="mb-3 font-type text-[11px] text-paper-faint">Signed with ML-DSA-65 and chained to the previous entry. Every 8 verdicts are anchored under one Merkle root.</p>
      {p ? <MerkleLadder proof={p} serverValid={proof.data?.valid} /> : (
        <div className="flex flex-wrap items-center gap-3 text-[12px]">
          <Chip tone="warn">pending anchor</Chip>
          <button className="btn-ghost" disabled={anchor.isPending || replay} onClick={() => anchor.mutate()}>Anchor now (admin)</button>
          {anchor.error && <ErrorNote error={anchor.error} />}
        </div>
      )}
    </Panel>
  );
}

export default function VerdictInspector() {
  const { idx } = useParams();
  const index = idx !== undefined ? Number(idx) : undefined;
  const q = useVerdict(index);
  const disputed = useDisputedKeys();

  if (index === undefined) {
    return (
      <div>
        <PageHeader directive="Directive 04 · Proof certificates" title="Verdict Inspector"
          lede="Every verdict opens into its proof: the six laws, every block, the Bell test, the transcript and its Merkle inclusion proof." />
        <RecentList />
      </div>
    );
  }
  const v = q.data;
  const r = (d: string) => v?.results.find((x) => x.detector === d);
  const cls = v && classOfVerdict(v, disputed);
  const d3 = r("D3");
  const d4 = r("D4");
  return (
    <div>
      <PageHeader directive={`Directive 04 · Case file ${docket(index)}`} title="Verdict Inspector"
        right={<Link to="/verdicts" className="no-print"><LinkText>← All verdicts</LinkText></Link>} />
      {q.isLoading && <Empty>Retrieving case file…</Empty>}
      {q.error && <ErrorNote error={q.error} />}
      {v && cls && (
        <div className="space-y-5">
          <VerdictBanner v={v} cls={cls} />
          <div>
            <div className="eyebrow mb-3">The six laws · D1 – D6</div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {r("D1") && <DetectorCard r={r("D1")!} />}
              {r("D2") && (
                <DetectorCard r={r("D2")!}>
                  <BlockHeatmap mismatches={v.certificate.transcript.block_mismatches} limit={r("D2")!.threshold ?? 0} failed={r("D2")!.extra.failed_blocks ?? []} />
                </DetectorCard>
              )}
              {d3 && (
                <DetectorCard r={d3}>
                  {d3.extra.chsh !== undefined && (
                    <>
                      <div className="flex justify-center"><ChshGauge S={d3.extra.chsh} threshold={d3.threshold ?? 2} size={260} /></div>
                      <p className="text-center text-[11.5px] text-paper-faint">fidelity F = <b className="data text-paper">{Number(d3.extra.fidelity).toFixed(3)}</b>
                        {d3.extra.z_drop_vs_baseline !== undefined && <> · z-drop vs baseline <span className="data">{Number(d3.extra.z_drop_vs_baseline).toFixed(2)}</span></>}</p>
                    </>
                  )}
                </DetectorCard>
              )}
              {d4 && (
                <DetectorCard r={d4}>
                  <div className="space-y-4">
                    <p className="text-[11.5px] text-paper-faint">QBER <b className="data text-paper">{pct(d4.extra.qber, 2)}</b> vs 11% · SPRT: {d4.extra.sprt_decision} after {d4.extra.sprt_rounds} rounds · CUSUM <span className="data">{Number(d4.extra.cusum).toFixed(3)}</span> / 0.03</p>
                    {d4.extra.fingerprint && <FingerprintPanel fp={d4.extra.fingerprint} />}
                    {d4.extra.bsm_counts && <BsmBars counts={d4.extra.bsm_counts} />}
                  </div>
                </DetectorCard>
              )}
              {r("D5") && <DetectorCard r={r("D5")!} />}
              {r("D6") && (
                <DetectorCard r={r("D6")!}>
                  {r("D6")!.extra.honeypot && <p className="font-label text-[12px] uppercase tracking-[.14em] text-reject">🪤 Physically valid signature — caught by a honeypot key.</p>}
                </DetectorCard>
              )}
            </div>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel title="Transcript" code="SHA3-256 sealed">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12px]">
                <dt className="label self-center">signer / key</dt><dd className="data break-all text-paper-dim">{v.certificate.signature.signer_id} / {v.certificate.signature.key_id}</dd>
                <dt className="label self-center">verifier</dt><dd className="text-paper-dim">{v.certificate.transcript.verifier_id}</dd>
                <dt className="label self-center">nonce / counter</dt><dd className="data break-all text-paper-dim">{v.certificate.signature.nonce} / {v.certificate.signature.counter}</dd>
                <dt className="label self-center">rounds / QBER</dt><dd className="data text-paper-dim">{v.certificate.transcript.total_rounds.toLocaleString()} / {pct(v.certificate.transcript.qber, 2)}</dd>
                <dt className="label self-center">backend / seed</dt><dd className="data text-paper-dim">{v.certificate.transcript.backend} / {v.certificate.transcript.seed}</dd>
                <dt className="label self-center">digest</dt><dd className="data break-all text-paper-dim">{v.certificate.transcript.digest_hex}</dd>
              </dl>
              <div className="mt-4"><div className="label mb-1">transcript hash</div><PunchCard hash={v.certificate.transcript_hash} /></div>
            </Panel>
            <Proof v={v} />
          </div>
          <Panel title="Export" code="certificate · QR · print"><CertificateExport verdict={v} /></Panel>
        </div>
      )}
    </div>
  );
}
