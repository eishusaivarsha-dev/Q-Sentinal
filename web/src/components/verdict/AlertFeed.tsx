import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { classOfEvent } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import type { VerdictEvent } from "@/lib/events";
import { clock } from "@/lib/format";
import AnimatedList from "@/fx/AnimatedList";
import { to } from "../shell/nav";
import { ClassChip, DecisionBadge, DetectorChip, Empty, Tabs } from "../ui";

/** Live verdict feed (newest first) built on React Bits' AnimatedList. Each row opens its proof. */
export default function AlertFeed({ events, disputed, limit = 40, maxHeight = 520 }: { events: VerdictEvent[]; disputed?: Set<string>; limit?: number; maxHeight?: number }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"all" | "alerts">("all");
  const rows = (mode === "alerts" ? events.filter((e) => e.data.decision === "REJECT" || e.data.alerts.some((a) => a.alert && a.severity !== "info")) : events).slice(0, limit);
  return (
    <div>
      <div className="mb-4"><Tabs value={mode} onChange={setMode} options={[["all", "All traffic"], ["alerts", "Alerts only"]]} /></div>
      {rows.length === 0 ? <Empty>Quiet so far. Run a quick action above and watch verdicts stream in.</Empty> : (
        <AnimatedList items={rows} maxHeight={maxHeight} itemKey={(e) => e.seq} onSelect={(e) => navigate(to(`verdicts/${e.data.ledger_index}`))}
          render={(e, selected) => {
            const cls = classOfEvent(e.data, disputed);
            const fired = e.data.alerts.filter((a) => a.alert && a.severity !== "info");
            const top = fired.find((a) => a.severity === "critical") ?? fired[0];
            return (
              <div className={cn("rounded-2xl border p-3.5 transition-all duration-300",
                selected ? "border-brand/40 bg-brand/5 shadow-[0_12px_30px_-20px_rgb(var(--brand))]" : "border-line bg-surface-2/70",
                e.data.decision === "REJECT" && !selected && "border-bad/25")}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <DecisionBadge decision={e.data.decision} />
                    <ClassChip cls={cls} />
                  </div>
                  <span className="data shrink-0 text-[12.5px] text-ink-3">{clock(e.ts)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="data text-[13px] text-ink-2">#{e.data.ledger_index} · {e.data.link}{e.data.transferred ? " (forwarded)" : ""}</span>
                  {fired.map((a) => <DetectorChip key={a.detector} id={a.detector} severity={a.severity} />)}
                </div>
                {top && <p className="mt-1.5 line-clamp-1 text-[13.5px] text-ink-3">{top.detector}: {top.detail}</p>}
              </div>
            );
          }} />
      )}
    </div>
  );
}
