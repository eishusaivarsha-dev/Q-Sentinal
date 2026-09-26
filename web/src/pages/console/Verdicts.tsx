// Verdict Inspector (docs/frontend-spec.md §4.4): every verdict opens into its proof - the six
// laws, every block, the Bell test, the transcript and its Merkle inclusion proof. The page only
// displays what GET /verdicts/{i} returns; it never re-decides anything.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Blocks, BrainCircuit, FileJson, Fingerprint, ListOrdered, ScrollText, ShieldAlert, Sparkles } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api/client";
import { useDisputedKeys, useVerdict, useVerdictSummaries } from "@/api/hooks";
import type { MerkleProof, VerdictSummary } from "@/api/types";
import { classOfVerdict } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { ago, docket, pct, shortHash } from "@/lib/format";
import { useSession } from "@/state/session";
import { useUi } from "@/state/ui";
import { Reveal } from "@/fx/motion";
import AnimatedList from "@/fx/AnimatedList";
import { to } from "@/components/shell/nav";
import { Card, Chip, DecisionBadge, Empty, ErrorNote, KeyVal, PageHeader, Skeleton } from "@/components/ui";
import ChshGauge from "@/components/verdict/ChshGauge";
import {
  BlockHeatmap, BsmBars, CertificateExport, DetectorCard, FingerprintPanel, HashStrip, MerkleLadder, VerdictBanner,
} from "@/components/verdict/parts";

function RecentList({ items, selected }: { items: VerdictSummary[]; selected?: number }) {
  const nav = useNavigate();
  return (
    <AnimatedList items={items} maxHeight={640} itemKey={(s) => s.ledger_index} onSelect={(s) => nav(to(`verdicts/${s.ledger_index}`))}
      render={(s) => (
        <div className={cn("flex items-center gap-3 rounded-2xl border p-3 transition-colors",
          selected === s.ledger_index ? "border-brand/50 bg-brand/8" : "border-line bg-surface hover:border-brand/30")}>
          <DecisionBadge decision={s.decision} />
          <div className="min-w-0 flex-1">
            <div className="data truncate text-[14px] font-semibold text-ink">{docket(s.ledger_index)} · {s.link}</div>
            <div className="truncate text-[12.5px] text-ink-3">{s.alerts.length ? s.alerts.map((a) => a.detector).join(" · ") : "no alerts"} · {ago(s.issued_at)}</div>
          </div>
          {s.transferred && <Chip tone="brand" className="!text-[11px]">fwd</Chip>}
        </div>
      )} />
  );
}

function LedgerProof({ idx, pending }: { idx: number; pending: boolean }) {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const proof = useQuery({ queryKey: ["proof", idx], queryFn: () => api.proof(idx), enabled: !pending, retry: false });
  const anchor = useMutation({
    mutationFn: api.anchor,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["verdict", idx] }); qc.invalidateQueries({ queryKey: ["proof", idx] }); },
  });
  const p: MerkleProof | undefined = proof.data;
  return (
    <Card title="Ledger & Merkle proof" sub={`entry #${idx} · ML-DSA-65 signed, hash-chained`} icon={Blocks}>
      {p ? <MerkleLadder proof={p} serverValid={p.valid} /> : (
        <div className="space-y-3">
          <p className="text-[15px] text-ink-2">Every few verdicts are anchored under one Merkle root. This one is not anchored yet.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Chip tone="warn" dot>pending anchor</Chip>
            <button className="btn-ghost btn-sm" disabled={anchor.isPending || replay} onClick={() => anchor.mutate()}>{anchor.isPending ? "Anchoring…" : "Anchor now (admin)"}</button>
          </div>
          {(anchor.error || proof.error) && !pending && <ErrorNote error={anchor.error ?? proof.error} />}
        </div>
      )}
    </Card>
  );
}

function FraudHint({ idx }: { idx: number }) {
  const f = useQuery({ queryKey: ["fraud-case", idx], queryFn: () => api.fraudCase(idx), retry: false });
  if (!f.data || f.data.risk < 25) return null;
  const c = f.data;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-violet/25 bg-violet/8 px-4 py-3 text-[14.5px]">
      <BrainCircuit size={18} className="text-violet" />
      <span className="font-semibold text-ink">AI fraud check (advisory):</span>
      <span className="text-ink-2">{c.category} · risk <b className="data">{c.risk}</b>/100</span>
      {c.review ? <Chip tone="ok">decided: {c.review.decision.replace("_", " ")}</Chip> : <Chip tone="warn" dot>awaiting your decision</Chip>}
      <Link className="link ml-auto" to={to(`fraud/${idx}`)}>Review →</Link>
    </div>
  );
}

export default function Verdicts() {
  const { idx } = useParams();
  const recent = useVerdictSummaries(100);
  const disputed = useDisputedKeys();
  const openCopilot = useUi((s) => s.openCopilot);
  const target = idx !== undefined ? Number(idx) : recent.data?.[0]?.ledger_index;
  const q = useVerdict(target);
  const v = q.data;
  const r = (d: string) => v?.results.find((x) => x.detector === d);
  const d2 = r("D2"), d3 = r("D3"), d4 = r("D4"), d6 = r("D6");

  return (
    <div>
      <PageHeader eyebrow="Operate · proof" title="Verdict" accent="Inspector"
        lede="Every verdict opens into its proof: the six laws, every block, the Bell test, the transcript and its Merkle inclusion proof — verifiable in your browser."
        right={v && <button className="btn-soft" onClick={() => openCopilot(`Explain #${v.certificate.ledger_index} in plain language.`)}><Sparkles size={16} />Explain with Sentinel</button>} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card title="Recent verdicts" sub="GET /verdicts" icon={ListOrdered} bodyClass="!pt-3">
          {recent.error && <ErrorNote error={recent.error} />}
          {!recent.data && !recent.error && <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>}
          {recent.data?.length === 0 && <Empty icon={ScrollText}>No verifications yet. Run one from Mission Control or the Attack Lab.</Empty>}
          {recent.data && recent.data.length > 0 && <RecentList items={recent.data} selected={target} />}
        </Card>

        <div className="min-w-0 space-y-6">
          {q.error && <ErrorNote error={q.error} />}
          {target !== undefined && !v && !q.error && <><Skeleton className="h-72" /><Skeleton className="h-96" /></>}
          {v && (
            <>
              <Reveal><VerdictBanner v={v} cls={classOfVerdict(v, disputed)} /></Reveal>
              <FraudHint idx={v.certificate.ledger_index} />
              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {v.results.map((res) => (
                  <DetectorCard key={res.detector} r={res}>
                    {res.detector === "D2" && d2 && (
                      <BlockHeatmap mismatches={v.certificate.transcript.block_mismatches} limit={d2.threshold ?? 0} failed={d2.extra.failed_blocks ?? []} />
                    )}
                    {res.detector === "D3" && d3?.extra.chsh !== undefined && (
                      <div>
                        <div className="flex justify-center"><ChshGauge S={d3.extra.chsh} threshold={d3.threshold ?? 2} size={230} /></div>
                        <p className="text-center text-[13px] text-ink-3">fidelity F = <b className="data text-ink">{Number(d3.extra.fidelity).toFixed(3)}</b></p>
                      </div>
                    )}
                    {res.detector === "D4" && d4 && (
                      <div className="space-y-4">
                        <p className="text-[13px] text-ink-3">QBER <b className="data text-ink">{pct(d4.extra.qber, 2)}</b> vs 11% · SPRT {d4.extra.sprt_decision} after {d4.extra.sprt_rounds} rounds</p>
                        {d4.extra.fingerprint && <FingerprintPanel fp={d4.extra.fingerprint} />}
                        {d4.extra.bsm_counts && <BsmBars counts={d4.extra.bsm_counts} />}
                      </div>
                    )}
                    {res.detector === "D6" && d6?.extra.honeypot && (
                      <p className="flex items-center gap-2 text-[14px] font-bold text-bad"><ShieldAlert size={16} />Physically valid signature — caught by a honeypot key.</p>
                    )}
                  </DetectorCard>
                ))}
              </div>
              <div className="grid gap-6 2xl:grid-cols-2">
                <Card title="Transcript" sub={`hash ${shortHash(v.certificate.transcript_hash, 10)}`} icon={Fingerprint}>
                  <HashStrip hash={v.certificate.transcript_hash} />
                  <div className="mt-5">
                    <KeyVal cols={3} items={[
                      ["Rounds", v.certificate.transcript.total_rounds.toLocaleString()], ["QBER", pct(v.certificate.transcript.qber, 2)],
                      ["Backend", v.certificate.transcript.backend], ["Seed", v.certificate.transcript.seed],
                      ["Nonce", shortHash(v.certificate.signature.nonce, 6)], ["Counter", v.certificate.signature.counter],
                    ]} />
                  </div>
                  <p className="mt-4 text-[14px] text-ink-3">Channel fingerprint: <span className="text-ink">{v.certificate.channel_fingerprint}</span></p>
                </Card>
                <LedgerProof idx={v.certificate.ledger_index} pending={v.certificate.merkle_proof === "pending"} />
              </div>
              <Card title="Export" sub="QR · JSON · print" icon={FileJson}><CertificateExport verdict={v} /></Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
