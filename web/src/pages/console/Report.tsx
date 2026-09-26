// Report: the D1-D6 acceptance criteria run against THIS build (GET /report/acceptance, on a
// throw-away system), plus a printable security report assembled from /overview, /verdicts,
// /ledger/audit and the analysts' fraud decisions (/reviews).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, FileText, Printer, RefreshCw, XCircle } from "lucide-react";
import { useState } from "react";
import { api } from "@/api/client";
import { useAudit, useOverview, useVerdictSummaries } from "@/api/hooks";
import type { AcceptanceCheck } from "@/api/types";
import { cn } from "@/lib/cn";
import { docket, stamp } from "@/lib/format";
import { Card, Chip, ErrorNote, PageHeader, Skeleton } from "@/components/ui";

function CheckRow({ c, i }: { c: AcceptanceCheck; i: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-line bg-surface">
      <button className="flex w-full items-center gap-4 p-4 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        {c.passed ? <CheckCircle2 className="shrink-0 text-ok" /> : <XCircle className="shrink-0 text-bad" />}
        <span className="data w-8 shrink-0 text-[15px] font-bold text-brand">{c.id}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-bold text-ink">{c.title}</span>
          <span className="block text-[13.5px] text-ink-3">{c.criterion}</span>
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-ink-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && <pre className="data mx-4 mb-4 max-h-72 overflow-auto rounded-xl bg-surface-2 p-3 text-[12px] text-ink-2" data-lenis-prevent>{JSON.stringify(c.evidence, null, 2)}</pre>}
    </motion.li>
  );
}

export default function Report() {
  const qc = useQueryClient();
  const acc = useQuery({ queryKey: ["acceptance"], queryFn: () => api.acceptance(), staleTime: Infinity, retry: false });
  const rerun = useMutation({ mutationFn: () => api.acceptance(true), onSuccess: (d) => qc.setQueryData(["acceptance"], d) });
  const ov = useOverview().data;
  const audit = useAudit().data;
  const verdicts = useVerdictSummaries(500).data ?? [];
  const reviews = useQuery({ queryKey: ["reviews"], queryFn: () => api.reviews(), refetchInterval: 10_000 }).data ?? [];
  const rejects = verdicts.filter((v) => v.decision === "REJECT");
  const byDetector = new Map<string, number>();
  rejects.forEach((v) => v.alerts.forEach((a) => byDetector.set(a.detector, (byDetector.get(a.detector) ?? 0) + 1)));
  const a = rerun.data ?? acc.data;
  const decided = reviews.filter((r) => r.agreed_with_ai !== null);

  return (
    <div>
      <PageHeader eyebrow="Prove · deliverables" title="Security" accent="Report"
        lede="The D1–D6 acceptance criteria, re-run against this exact build, and a printable report of everything the system has decided — including every human fraud decision."
        right={<button className="btn-primary" onClick={() => window.print()}><Printer size={16} />Print / PDF</button>} />

      <Card title="D1–D6 acceptance" sub={a ? `${a.mode} run · ${a.seconds.toFixed(1)} s · ${stamp(a.generated_at)}` : "GET /report/acceptance"} icon={CheckCircle2} className="no-print mb-6"
        actions={<>
          {a && <Chip tone={a.passed ? "ok" : "bad"}>{a.checks.filter((c) => c.passed).length}/{a.checks.length} passed</Chip>}
          <button className="btn-ghost btn-sm" disabled={rerun.isPending} onClick={() => rerun.mutate()}><RefreshCw size={14} className={rerun.isPending ? "animate-spin" : ""} />{rerun.isPending ? "Running…" : "Re-run"}</button>
        </>}>
        {(acc.error || rerun.error) && <ErrorNote error={acc.error ?? rerun.error} />}
        {!a && !acc.error && <div className="space-y-2">{acc.isFetching && <p className="text-[14px] text-ink-3">Running the acceptance checks (about 10 s)…</p>}{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>}
        {a && <ol className="space-y-2.5">{a.checks.map((c, i) => <CheckRow key={c.id} c={c} i={i} />)}</ol>}
      </Card>

      <article className="card mx-auto max-w-4xl p-8 md:p-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow">Q-SENTINEL · Trust Console</div>
            <h2 className="mt-2 text-[40px] font-extrabold leading-tight text-ink">Security Report</h2>
            <p className="text-[14px] text-ink-3">Issued {stamp(Date.now() / 1000)} · ledger {ov?.ledger.entries ?? "–"} entries · chain {ov ? (ov.ledger.chain_ok ? "valid" : "BROKEN") : "–"}</p>
          </div>
          <FileText size={40} className="text-brand" />
        </div>
        <div className="hairline-x my-6" />
        <h3 className="label">1. Summary</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{ov?.verdicts.total ?? verdicts.length} signatures were verified; {ov?.verdicts.reject ?? rejects.length} were rejected. {ov?.alerts.critical ?? 0} critical alerts, {ov?.alerts.warning ?? 0} warnings, {ov?.disputes ?? 0} transferability disputes. Every verdict was issued by closed-form detectors — AI in trust path: <b>NO</b>. {reviews.length} fraud decision{reviews.length === 1 ? " was" : "s were"} made by analysts{decided.length ? `; they agreed with the AI's suggestion ${decided.filter((r) => r.agreed_with_ai).length} of ${decided.length} times` : ""}.</p>
        <h3 className="label mt-6">2. Rejections by detector</h3>
        <table className="mt-2 w-full text-[14px]"><tbody>
          {byDetector.size === 0 ? <tr><td className="py-1 text-ink-3">None.</td></tr> : [...byDetector.entries()].sort().map(([d, n]) => (
            <tr key={d} className="border-b border-line"><td className="data py-1.5">{d}</td><td className="data text-right">{n}</td></tr>
          ))}
        </tbody></table>
        <h3 className="label mt-6">3. Ledger audit</h3>
        <p className="mt-2 text-[15px] text-ink-2">{audit ? `${audit.chain_detail}. Anchor problems: ${audit.anchor_problems.length || "none"}. Symmetrisation: ${audit.symmetrisation.committed} committed, ${audit.symmetrisation.revealed} revealed. Disputes: ${audit.disputes.length}.` : "–"}</p>
        <h3 className="label mt-6">4. Analyst fraud decisions</h3>
        <table className="mt-2 w-full text-left text-[13px]">
          <thead className="text-ink-3"><tr className="border-b border-line-2"><th className="py-1.5">Case</th><th>Decision</th><th>AI suggested</th><th>Reviewer</th><th>Note</th></tr></thead>
          <tbody>
            {reviews.length === 0 ? <tr><td colSpan={5} className="py-1.5 text-ink-3">No decisions recorded.</td></tr> : reviews.slice(-30).reverse().map((r) => (
              <tr key={r.index} className="border-b border-line align-top">
                <td className="data py-1.5">{docket(r.verdict_index ?? 0)}</td><td className="font-semibold">{r.decision.replace("_", " ")}</td>
                <td>{r.advisory ? `${r.advisory.recommendation.replace("_", " ")} (${r.advisory.risk})` : "–"}</td><td>{r.reviewer}</td><td className="text-ink-3">{r.note || "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 className="label mt-6">5. Incident log</h3>
        <table className="mt-2 w-full text-left text-[13px]">
          <thead className="text-ink-3"><tr className="border-b border-line-2"><th className="py-1.5">Docket</th><th>Issued</th><th>Link</th><th>Alerts</th></tr></thead>
          <tbody>
            {rejects.slice(0, 40).map((v) => (
              <tr key={v.ledger_index} className="border-b border-line align-top">
                <td className="data py-1.5 pr-2">{docket(v.ledger_index)}</td><td className="pr-2">{stamp(v.issued_at)}</td><td className="data pr-2">{v.link}</td>
                <td>{v.alerts.map((x) => `${x.detector} (${x.severity})`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="data mt-8 text-[12px] text-ink-3">Verify any entry at /ledger/proof/&#123;index&#125;</p>
      </article>
    </div>
  );
}
