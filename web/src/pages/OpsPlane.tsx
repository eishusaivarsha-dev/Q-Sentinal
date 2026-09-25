// Ops Plane (docs/frontend-spec.md §4.9): advisory only, fenced off from every decision.
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { OPS_URL } from "../api/client";
import { api, errorText } from "../api/client";
import { AdvisoryFrame, Card, Empty, Pill } from "../components/ui";
import { ago, pct } from "../lib/physics";

export default function OpsPlane() {
  const q = useQuery({ queryKey: ["incidents"], queryFn: api.incidents, refetchInterval: 5000, retry: false });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Ops Plane (AI helper)</h1>
        <p className="text-sm text-slate-400">Groups alert storms into incidents and writes plain-English summaries. It reads a copy of the results and can never change a verdict.</p>
      </div>
      <AdvisoryFrame>
        {q.error ? (
          <div className="space-y-2 text-sm">
            <p className="text-amber-200">The advisory service isn't reachable at {OPS_URL} ({errorText(q.error)}).</p>
            <p className="text-slate-400">Start it with:</p>
            <pre className="rounded bg-slate-900 p-2 text-xs">pip install -e ops{"\n"}uvicorn qsentinel_ops.server:app --port 8100</pre>
          </div>
        ) : !q.data ? <Empty>Loading…</Empty> : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Pill tone="info">{q.data.alerts} alerting verifications</Pill>
              <Pill tone="info">{q.data.incidents.length} incidents</Pill>
              <Pill tone="ok">{pct(q.data.reduction, 0)} fewer items to review</Pill>
            </div>
            {q.data.incidents.length ? q.data.incidents.map((inc) => (
              <Card key={inc.id} title={`Incident ${inc.id + 1}: ${inc.size} verification(s)`} right={<span className="text-xs text-slate-500">{ago(inc.last_ts)}</span>}>
                <p className="text-sm text-slate-200">{inc.narrative}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {inc.detectors.map((d) => <Pill key={d} tone="warn">{d}</Pill>)}
                  {inc.links.map((l) => <Pill key={l}>{l}</Pill>)}
                </div>
                <p className="mt-2 text-xs text-slate-400">Ground truth: {inc.ledger_indices.filter((i): i is number => i !== null).slice(0, 12).map((i) => (
                  <Link key={i} className="mr-2 text-cyan-300 underline" to={`/verdicts/${i}`}>#{i}</Link>
                ))}</p>
              </Card>
            )) : <Empty>No alerts yet.</Empty>}
          </div>
        )}
      </AdvisoryFrame>
    </div>
  );
}
