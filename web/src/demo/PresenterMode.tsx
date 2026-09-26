// Presenter Mode (docs/frontend-spec.md §9): a clapperboard bar that drives the 7-step demo.
// Keys: ← → scenes · Space/Enter runs the scene · Esc exits.
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { errorText } from "@/api/client";
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
        <motion.div initial={{ y: 220 }} animate={{ y: 0 }} exit={{ y: 240 }} transition={{ type: "spring", stiffness: 160, damping: 20 }}
          className="no-print fixed inset-x-2 bottom-2 z-[80] md:inset-x-6 md:bottom-4 lg:left-[270px]">
          <div className="panel overflow-hidden !bg-ink/95" style={{ boxShadow: "inset 0 0 0 1px rgba(240,165,58,.5), 0 30px 60px -10px #000" }}>
            <div className="h-3 w-full" style={{ background: "repeating-linear-gradient(120deg,#e9dcc0 0 18px,#0c0a07 18px 36px)" }} />
            <div className="grid gap-4 p-4 md:grid-cols-[auto_1fr_auto] md:items-center md:px-6">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="label">Scene</div>
                  <div className="font-display text-[40px] leading-none text-amber">{step + 1}<span className="text-[18px] text-paper-faint">/{SCRIPT.length}</span></div>
                </div>
                <div className="text-center">
                  <div className="label">Reel</div>
                  <div className={`data text-[20px] ${over ? "text-reject" : "phosphor"}`}>{mmss(elapsed)}</div>
                  <div className="data text-[10px] text-paper-faint">of {mmss(SCRIPT_BUDGET)}</div>
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-3"><h2 className="font-display text-[24px] text-paper">{s.title}</h2><span className="data text-[11px] text-paper-faint">~{s.seconds}s</span></div>
                <p className="mt-1 text-[13px] leading-snug text-paper-dim">{s.caption}</p>
                {result && <p className={`mt-2 rounded-md border hair bg-ink/70 p-2 text-[12px] ${result.startsWith("Error") ? "text-reject" : "text-amber-hot"}`}>{result}</p>}
                <div className="mt-2 flex gap-1">{SCRIPT.map((_, i) => (
                  <button key={i} onClick={() => goStep(i)} aria-label={`Scene ${i + 1}`} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-amber/60" : i === step ? "bg-amber" : "bg-ink-500"}`} />
                ))}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-danger" disabled={busy} onClick={run}>{busy ? "Transmitting…" : "⚡ Run scene"}</button>
                <button className="btn-ghost" onClick={() => goStep(Math.max(0, step - 1))} disabled={step === 0 || busy}>←</button>
                <button className="btn-primary" disabled={busy} onClick={() => (step === SCRIPT.length - 1 ? closePresenter() : goStep(step + 1))}>{step === SCRIPT.length - 1 ? "Finish" : "Next →"}</button>
                <button className="btn-ghost !px-2.5" onClick={closePresenter} aria-label="Exit presenter">✕</button>
              </div>
            </div>
            <div className="border-t hair px-6 py-1.5 font-type text-[10.5px] text-paper-mute">
              ← → scenes · Space runs the scene · Esc exits{replay ? " · answering from the recorded session (offline)" : ""}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
