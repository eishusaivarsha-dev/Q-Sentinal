// /report: a printable security report built from existing endpoints (spec §10 "Still open": a
// dedicated GET /report does not exist yet, so this assembles /overview, /verdicts and /ledger/audit).
import { useAudit, useOverview, useVerdictSummaries } from "@/api/hooks";
import { docket, stamp } from "@/lib/format";

export default function Report() {
  const ov = useOverview().data;
  const audit = useAudit().data;
  const verdicts = useVerdictSummaries(500).data ?? [];
  const rejects = verdicts.filter((v) => v.decision === "REJECT");
  const byDetector = new Map<string, number>();
  rejects.forEach((v) => v.alerts.forEach((a) => byDetector.set(a.detector, (byDetector.get(a.detector) ?? 0) + 1)));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex justify-end"><button className="btn-primary" onClick={() => window.print()}>Print / save PDF</button></div>
      <article className="print-sheet relative rounded-sm p-8 font-type text-[13px] text-ink shadow-[10px_10px_0_#000] md:p-12"
        style={{ background: "#e9dcc0", backgroundImage: "radial-gradient(circle at 80% 10%, rgba(120,80,20,.12), transparent 40%), radial-gradient(circle at 10% 90%, rgba(120,80,20,.1), transparent 40%)" }}>
        <div className="absolute right-8 top-8 rotate-[8deg] border-4 border-[#8e3219] px-3 py-1 font-label text-[16px] tracking-[.3em] text-[#8e3219] opacity-80">SEALED</div>
        <div className="font-label text-[11px] uppercase tracking-[.3em]">Q-SENTINEL · Trust Console</div>
        <h1 className="mt-2 font-display text-[40px] leading-tight">Security Report</h1>
        <div className="mt-1">Issued {stamp(Date.now() / 1000)} · Ledger {ov?.ledger.entries ?? "–"} entries · chain {ov ? (ov.ledger.chain_ok ? "valid" : "BROKEN") : "–"}</div>
        <div className="my-6 h-[2px] bg-ink" />
        <h2 className="font-label text-[13px] uppercase tracking-[.2em]">1. Summary</h2>
        <p className="mt-2">{ov?.verdicts.total ?? verdicts.length} signatures were verified; {ov?.verdicts.reject ?? rejects.length} were rejected. {ov?.alerts.critical ?? 0} critical alerts, {ov?.alerts.warning ?? 0} warnings, {ov?.disputes ?? 0} transferability disputes. Every decision was issued by closed-form detectors — AI in trust path: NO.</p>
        <h2 className="mt-6 font-label text-[13px] uppercase tracking-[.2em]">2. Rejections by detector</h2>
        <table className="mt-2 w-full border-collapse">
          <tbody>
            {byDetector.size === 0 ? <tr><td>None.</td></tr> : [...byDetector.entries()].sort().map(([d, n]) => (
              <tr key={d} className="border-b border-ink/30"><td className="py-1">{d}</td><td className="text-right">{n}</td></tr>
            ))}
          </tbody>
        </table>
        <h2 className="mt-6 font-label text-[13px] uppercase tracking-[.2em]">3. Ledger audit</h2>
        <p className="mt-2">{audit ? `${audit.chain_detail}. Anchor problems: ${audit.anchor_problems.length || "none"}. Symmetrisation: ${audit.symmetrisation.committed} committed, ${audit.symmetrisation.revealed} revealed. Disputes: ${audit.disputes.length}.` : "–"}</p>
        <h2 className="mt-6 font-label text-[13px] uppercase tracking-[.2em]">4. Incident log</h2>
        <table className="mt-2 w-full border-collapse text-[11.5px]">
          <thead><tr className="border-b-2 border-ink text-left"><th>Docket</th><th>Issued</th><th>Link</th><th>Alerts</th></tr></thead>
          <tbody>
            {rejects.slice(0, 40).map((v) => (
              <tr key={v.ledger_index} className="border-b border-ink/20 align-top">
                <td className="py-1 pr-2">{docket(v.ledger_index)}</td><td className="pr-2">{stamp(v.issued_at)}</td><td className="pr-2">{v.link}</td>
                <td>{v.alerts.map((a) => `${a.detector} (${a.severity})`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-10 flex justify-between text-[11px]"><span>Verify any entry at /ledger/proof/&#123;index&#125;</span><span>Page 1 of 1</span></div>
      </article>
    </div>
  );
}
