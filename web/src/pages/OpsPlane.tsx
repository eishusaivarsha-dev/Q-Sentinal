// Ops Plane (docs/frontend-spec.md §4.9): advisory only, fenced off from every decision.
// Also hosts the STIX 2.1 export of rejected verdicts (Phase 5).
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, errorText, OPS_URL } from "@/api/client";
import { useVerdictSummaries } from "@/api/hooks";
import type { VerdictSummary } from "@/api/types";
import { ago, pct } from "@/lib/format";
import { downloadJson } from "@/state/session";
import { AdvisoryFrame } from "@/components/ops/AdvisoryFrame";
import { Chip, DetectorChip, Empty, LinkText, PageHeader, Panel } from "@/components/shell/primitives";

/** STIX 2.1 bundle: one indicator + observed-data style note per rejected verdict. Facts only. */
function toStix(rejects: VerdictSummary[]) {
  const now = new Date().toISOString();
  const identity = { type: "identity", spec_version: "2.1", id: `identity--${crypto.randomUUID()}`, created: now, modified: now, name: "Q-SENTINEL", identity_class: "system" };
  const objects: object[] = [identity];
  for (const v of rejects) {
    const detectors = v.alerts.map((a) => a.detector).join(",");
    objects.push({
      type: "indicator", spec_version: "2.1", id: `indicator--${crypto.randomUUID()}`, created: now, modified: now,
      created_by_ref: identity.id, name: `QDS verdict #${v.ledger_index} REJECT (${detectors || "no alerts"})`,
      description: v.alerts.map((a) => `${a.detector} [${a.severity}]: ${a.detail}`).join(" | "),
      pattern_type: "stix", pattern: `[x-qsentinel-verdict:ledger_index = ${v.ledger_index}]`,
      valid_from: new Date(v.issued_at * 1000).toISOString(),
      labels: ["quantum-digital-signature", ...v.alerts.map((a) => a.severity)],
      external_references: [{ source_name: "q-sentinel-ledger", external_id: String(v.ledger_index), description: `link ${v.link}, key ${v.key_id}` }],
    });
  }
  return { type: "bundle", id: `bundle--${crypto.randomUUID()}`, objects };
}

export default function OpsPlane() {
  const q = useQuery({ queryKey: ["incidents"], queryFn: api.incidents, refetchInterval: 5000, retry: false });
  const summaries = useVerdictSummaries(500);
  const rejects = (summaries.data ?? []).filter((v) => v.decision === "REJECT");

  return (
    <div>
      <PageHeader directive="Directive 09 · Operations" title="Ops Plane"
        lede="Groups alert storms into incidents and writes plain-English summaries. It reads a copy of the results and can never change a verdict."
        right={<button className="btn-ghost" disabled={!rejects.length} onClick={() => downloadJson(`qsentinel-stix-${Date.now()}.json`, toStix(rejects))}>Export STIX 2.1 ({rejects.length})</button>} />
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <AdvisoryFrame title="Incident triage">
          {q.error ? (
            <div className="space-y-2 text-[12.5px]">
              <p className="text-amber-hot">The advisory service isn't reachable at <span className="data">{OPS_URL}</span> ({errorText(q.error)}).</p>
              <p className="text-paper-faint">Start it with:</p>
              <pre className="data rounded-md border hair bg-ink/60 p-2 text-[11px] text-paper-dim">pip install -e ops{"\n"}uvicorn qsentinel_ops.server:app --port 8100</pre>
            </div>
          ) : !q.data ? <Empty>Loading…</Empty> : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Chip tone="info">{q.data.alerts} alerting verifications</Chip>
                <Chip tone="info">{q.data.incidents.length} incidents</Chip>
                <Chip tone="ok">{pct(q.data.reduction, 0)} fewer items to review</Chip>
              </div>
              {q.data.incidents.length ? q.data.incidents.map((inc) => (
                <div key={inc.id} className="rounded-md border border-amber/20 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-[18px] text-paper">Incident {inc.id + 1} · {inc.size} verification(s)</h3>
                    <span className="data text-[10.5px] text-paper-faint">{ago(inc.last_ts)} · mean QBER {pct(inc.mean_qber)}</span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-paper-dim">{inc.narrative}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {inc.detectors.map((d) => <DetectorChip key={d} id={d} severity="warning" />)}
                    {inc.links.map((l) => <Chip key={l}>{l}</Chip>)}
                  </div>
                  <p className="mt-2 text-[11px] text-paper-faint">Ground truth ↓ {inc.ledger_indices.filter((i): i is number => i !== null).slice(0, 12).map((i) => (
                    <Link key={i} className="mr-2" to={`/verdicts/${i}`}><LinkText>#{i}</LinkText></Link>
                  ))}</p>
                </div>
              )) : <Empty>No alerts yet.</Empty>}
            </div>
          )}
        </AdvisoryFrame>
        <Panel title="Trust boundary" code="architecture">
          <p className="text-[12.5px] leading-relaxed text-paper-dim">Verdicts come from the verifier's six closed-form detectors. The ops plane subscribes to the same telemetry, read-only, through a one-way valve. It has no write path to the verifier, the key store or the ledger — and CI fails if an ML library is imported into the trust kernel.</p>
          <p className="mt-3 text-[12px] text-paper-faint">The STIX export above contains only facts from the ledger (detector, severity, detail), not advisory text.</p>
        </Panel>
      </div>
    </div>
  );
}
