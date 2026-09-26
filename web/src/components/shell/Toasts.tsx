import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { glyphForClass } from "@/lib/attribution";
import { useTelemetry } from "@/state/telemetry";
import { AttackGlyph } from "../art/AttackGlyph";
import { ClassChip, DecisionBadge, DetectorChip } from "./primitives";

/** Incident telegrams, rendered synchronously from the WebSocket event (well inside the 1 s SLA). */
export function Toasts() {
  const toasts = useTelemetry((s) => s.toasts);
  const dismiss = useTelemetry((s) => s.dismiss);
  const navigate = useNavigate();

  useEffect(() => {
    const timers = toasts.map((t) => setTimeout(() => dismiss(t.id), 10_000));
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <div className="no-print pointer-events-none fixed right-3 top-16 z-[70] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2" aria-live="assertive">
      {toasts.map(({ id, cls, data, critical }) => {
        const top = data.alerts.find((a) => a.severity === "critical") ?? data.alerts[0];
        return (
          <div key={id} role="alert" className="panel pointer-events-auto animate-slideIn overflow-hidden !bg-[#1d0f0a]/95"
            style={{ boxShadow: "inset 0 0 0 1px rgba(224,81,58,.55), 0 20px 40px -10px rgba(0,0,0,.9), 0 0 30px -8px rgba(224,81,58,.5)" }}>
            <div className="flex items-center justify-between border-b border-reject/30 bg-reject/15 px-4 py-1.5">
              <span className="font-label text-[10px] uppercase tracking-[.3em] text-reject">⚠ {critical ? "Critical" : "Incident"} telegram</span>
              <span className="data text-[10px] text-paper-faint">#{data.ledger_index} · {data.link}</span>
            </div>
            <div className="flex gap-3 p-3">
              <div className="shrink-0"><AttackGlyph glyph={glyphForClass(cls.label)} size={48} hot /></div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <DecisionBadge decision={data.decision} />
                  <ClassChip cls={cls} />
                </div>
                <div className="flex flex-wrap gap-1">{data.alerts.map((a) => <DetectorChip key={a.detector} id={a.detector} severity={a.severity} />)}</div>
                {top && <div className="mt-1.5 line-clamp-2 text-[11px] text-paper-dim">{top.detector}: {top.detail}</div>}
                <div className="mt-2 flex gap-3">
                  <button onClick={() => { dismiss(id); navigate(`/verdicts/${data.ledger_index}`); }}
                    className="font-label text-[11px] uppercase tracking-[.18em] text-amber hover:underline">Open proof →</button>
                  <button onClick={() => dismiss(id)} className="font-label text-[11px] uppercase tracking-[.18em] text-paper-faint hover:text-paper">Dismiss</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
