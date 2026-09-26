import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useUi } from "@/state/ui";
import CopilotChat from "./CopilotChat";

/** Slide-over copilot, reachable from every console page (top bar "Ask Sentinel"). */
export default function CopilotDrawer() {
  const open = useUi((s) => s.copilot);
  const close = useUi((s) => s.closeCopilot);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, close]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="no-print fixed inset-0 z-[100] bg-ink/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="no-print fixed inset-y-0 right-0 z-[101] flex w-full max-w-[520px] flex-col border-l border-line bg-surface shadow-2xl">
            <div className="flex items-center justify-between px-5 pt-4">
              <p className="eyebrow">Sentinel Copilot</p>
              <button className="btn-icon !h-9 !w-9" onClick={close} aria-label="Close copilot"><X size={16} /></button>
            </div>
            <CopilotChat compact className="flex-1" />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
