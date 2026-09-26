// Live alert toasts: every REJECT or critical verdict from the telemetry feed (spec §3, §14).
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTelemetry } from "@/state/telemetry";
import { DetectorChip } from "../ui";
import { to } from "./nav";

export default function Toasts() {
  const toasts = useTelemetry((s) => s.toasts);
  const dismiss = useTelemetry((s) => s.dismiss);
  const nav = useNavigate();
  useEffect(() => {
    if (!toasts.length) return;
    const id = toasts[0].id;
    const t = window.setTimeout(() => dismiss(id), 7000);
    return () => window.clearTimeout(t);
  }, [toasts, dismiss]);
  return (
    <div className="no-print pointer-events-none fixed bottom-5 right-5 z-[70] flex w-[380px] max-w-[calc(100vw-40px)] flex-col gap-3">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div key={t.id} layout initial={{ opacity: 0, x: 60, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 60 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="card pointer-events-auto cursor-pointer overflow-hidden !border-bad/30 p-4" onClick={() => { nav(to(`verdicts/${t.data.ledger_index}`)); dismiss(t.id); }}>
            <div className="absolute inset-y-0 left-0 w-1 bg-bad" />
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bad/12 text-bad"><ShieldAlert size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[15px] font-bold text-ink">{t.cls.label}</p>
                  <button onClick={(e) => { e.stopPropagation(); dismiss(t.id); }} className="text-ink-3 hover:text-ink" aria-label="Dismiss"><X size={16} /></button>
                </div>
                <p className="data mt-0.5 text-[13px] text-ink-3">#{t.data.ledger_index} · {t.data.link} · {t.data.decision}</p>
                <div className="mt-2 flex flex-wrap gap-1">{t.data.alerts.filter((a) => a.alert && a.severity !== "info").map((a) => <DetectorChip key={a.detector} id={a.detector} severity={a.severity} />)}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
