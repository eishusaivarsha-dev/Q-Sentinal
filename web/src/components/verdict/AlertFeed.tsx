import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VerdictEvent } from "@/lib/events";
import { classOfEvent } from "@/lib/attribution";
import { clock } from "@/lib/format";
import { ClassChip, DecisionBadge, DetectorChip, Empty } from "../shell/primitives";

/** Teleprinter tape of verdict events (newest first). Each row opens its proof certificate. */
export function AlertFeed({ events, disputed, limit = 30 }: { events: VerdictEvent[]; disputed?: Set<string>; limit?: number }) {
  const navigate = useNavigate();
  const [onlyIncidents, setOnly] = useState(false);
  const rows = (onlyIncidents ? events.filter((e) => e.data.decision === "REJECT" || e.data.alerts.length) : events).slice(0, limit);
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {(["All traffic", "Alerts only"] as const).map((l, i) => (
          <button key={l} onClick={() => setOnly(!!i)} className={`chip ${onlyIncidents === !!i ? "border-amber text-amber" : "border-paper-mute/40 text-paper-faint hover:text-paper"}`}>{l}</button>
        ))}
      </div>
      {rows.length === 0 ? <Empty>Tape is quiet. Run a signature from the quick-demo levers.</Empty> : (
        <ol className="divide-y divide-amber/10">
          {rows.map((e) => {
            const cls = classOfEvent(e.data, disputed);
            const top = e.data.alerts.find((a) => a.severity === "critical") ?? e.data.alerts[0];
            return (
              <li key={e.seq}>
                <button onClick={() => navigate(`/verdicts/${e.data.ledger_index}`)}
                  className={`group grid w-full grid-cols-[auto_1fr] items-start gap-x-3 px-2 py-2.5 text-left transition hover:bg-amber/[.04] ${e.data.decision === "REJECT" ? "bg-reject/[.05]" : ""}`}>
                  <span className="flex flex-col items-start gap-1">
                    <span className="data text-[11px] text-paper-faint">{clock(e.ts)}</span>
                    <DecisionBadge decision={e.data.decision} />
                  </span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <ClassChip cls={cls} />
                      {e.data.alerts.map((a) => <DetectorChip key={a.detector} id={a.detector} severity={a.severity} />)}
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-paper-dim group-hover:text-paper">
                      <span className="data text-paper-faint">#{e.data.ledger_index} · {e.data.link}{e.data.transferred ? " (forwarded)" : ""}</span>
                      {top && <> · {top.detector}: {top.detail}</>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
