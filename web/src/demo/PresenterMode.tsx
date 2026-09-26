// Presenter Mode (docs/frontend-spec.md §9): a floating control bar that drives the 7-step demo.
// Keys: ← → scenes · Space/Enter runs the scene · Esc exits.
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { errorText } from "@/api/client";
import { cn } from "@/lib/cn";
import { useSession } from "@/state/session";
import { useUi } from "@/state/ui";
import { SCRIPT, SCRIPT_BUDGET } from "./script";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function PresenterMode() {
  const { presenter, step, startedAt, goStep, closePresenter } = useUi();
  const replay = useSession((s) => s.replay);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const s = SCRIPT[step];

  useEffect(() => {
    if (!presenter || !startedAt) return;
    const i = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 250);
    return () => clearInterval(i);
  }, [presenter, startedAt]);

  useEffect(() => setResult(""), [step]);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setResult("");
    try {
      setResult(await SCRIPT[useUi.getState().step].run(nav));
    } catch (e) {
      setResult(`Error: ${errorText(e)}`);
    } finally {
      setBusy(false);
      qc.invalidateQueries();
    }
  }, [busy, nav, qc]);

  useEffect(() => {
    if (!presenter) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input,select,textarea,button")) return;
      const cur = useUi.getState().step;
      if (e.key === "ArrowRight" || e.key === "PageDown") goStep(Math.min(SCRIPT.length - 1, cur + 1));
      else if (e.key === "ArrowLeft" || e.key === "PageUp") goStep(Math.max(0, cur - 1));
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); void run(); }
      else if (e.key === "Escape") closePresenter();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [presenter, goStep, closePresenter, run]);

  const over = elapsed > SCRIPT_BUDGET;

  return (
    <AnimatePresence>
      {presenter && (
        <motion.div initial={{ y: 220, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 240, opacity: 0 }} transition={{ type: "spring", stiffness: 170, damping: 22 }}
          className="no-print fixed inset-x-3 bottom-3 z-[80] md:inset-x-8 md:bottom-6 lg:left-[300px]">
          <div className="glass overflow-hidden rounded-3xl shadow-2xl">
            <div className="h-1 w-full bg-line"><motion.div className="h-1" style={{ background: "linear-gradient(90deg, rgb(var(--brand)), rgb(var(--brand-2)))" }} animate={{ width: `${((step + 1) / SCRIPT.length) * 100}%` }} /></div>
            <div className="grid gap-5 p-5 md:grid-cols-[auto_1fr_auto] md:items-center md:px-7">
              <div className="flex items-center gap-6">
                <div>
                  <div className="label !text-[11px]">Scene</div>
                  <div className="text-[38px] font-extrabold leading-none text-brand">{step + 1}<span className="text-[18px] text-ink-3">/{SCRIPT.length}</span></div>
                </div>
                <div>
                  <div className="label !text-[11px]">Clock</div>
                  <div className={cn("data text-[22px] font-semibold", over ? "text-bad" : "text-ink")}>{mmss(elapsed)}</div>
                  <div className="data text-[11px] text-ink-3">of {mmss(SCRIPT_BUDGET)}</div>
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-3"><h2 className="text-[22px] font-bold text-ink">{s.title}</h2><span className="data text-[12px] text-ink-3">~{s.seconds}s</span></div>
                <p className="mt-1 text-[15px] leading-snug text-ink-2">{s.caption}</p>
                {result && <p className={cn("mt-2 rounded-xl border border-line bg-surface-2 p-2.5 text-[14px]", result.startsWith("Error") ? "text-bad" : "text-brand")}>{result}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-danger" disabled={busy} onClick={run}><Play size={16} /> {busy ? "Running…" : "Run scene"}</button>
                <button className="btn-icon" onClick={() => goStep(Math.max(0, step - 1))} disabled={step === 0 || busy} aria-label="Previous scene"><ChevronLeft size={18} /></button>
                <button className="btn-primary" disabled={busy} onClick={() => (step === SCRIPT.length - 1 ? closePresenter() : goStep(step + 1))}>
                  {step === SCRIPT.length - 1 ? "Finish" : <>Next <ChevronRight size={16} /></>}
                </button>
                <button className="btn-icon" onClick={closePresenter} aria-label="Exit presenter"><X size={16} /></button>
              </div>
            </div>
            <div className="border-t border-line px-7 py-2 font-mono text-[12px] text-ink-3">
              ← → scenes · Space runs the scene · Esc exits{replay ? " · answering from the recorded session (offline)" : ""}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
