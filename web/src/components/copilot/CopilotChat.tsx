// Sentinel Copilot chat: streams answers from the advisory ops service (Claude when a key is
// configured, the offline analyst otherwise). Advisory only - it can explain verdicts, never make them.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Bot, ShieldCheck, Sparkles, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { create } from "zustand";
import { errorText, streamCopilot, type ChatTurn } from "@/api/client";
import { useCopilotStatus, useVerdictSummaries } from "@/api/hooks";
import { cn } from "@/lib/cn";
import { useUi } from "@/state/ui";
import { to } from "../shell/nav";

interface ChatState {
  turns: ChatTurn[];
  busy: boolean;
  meta: { mode: string; model: string } | null;
  controller: AbortController | null;
  ask(q: string): Promise<void>;
  stop(): void;
  clear(): void;
}

export const useChat = create<ChatState>((set, get) => ({
  turns: [],
  busy: false,
  meta: null,
  controller: null,
  ask: async (q) => {
    const question = q.trim();
    if (!question || get().busy) return;
    const history = get().turns.slice(-8);
    const controller = new AbortController();
    set({ turns: [...get().turns, { role: "user", content: question }, { role: "assistant", content: "" }], busy: true, controller });
    const append = (text: string) => set((s) => {
      const turns = [...s.turns];
      turns[turns.length - 1] = { role: "assistant", content: turns[turns.length - 1].content + text };
      return { turns };
    });
    try {
      await streamCopilot(question, history, append, (meta) => set({ meta }), controller.signal);
    } catch (e) {
      append(`\n\nCouldn't reach the copilot: ${errorText(e)}`);
    } finally {
      set({ busy: false, controller: null });
    }
  },
  stop: () => get().controller?.abort(),
  clear: () => set({ turns: [], meta: null }),
}));

/** Renders "- " bullets as a list and #123 as links to that verdict's certificate. */
function Rich({ text }: { text: string }) {
  const linkify = (line: string): ReactNode[] =>
    line.split(/(#\d{1,6})/g).map((part, i) =>
      /^#\d+$/.test(part) ? <Link key={i} to={to(`verdicts/${part.slice(1)}`)} className="link data">{part}</Link> : part);
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        const bullets = lines.filter((l) => /^\s*[-•]\s/.test(l));
        const head = lines.filter((l) => !/^\s*[-•]\s/.test(l));
        return (
          <div key={i}>
            {head.map((l, j) => <p key={j}>{linkify(l)}</p>)}
            {bullets.length > 0 && (
              <ul className="mt-1.5 space-y-1.5">
                {bullets.map((l, j) => (
                  <li key={j} className="flex gap-2"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /><span>{linkify(l.replace(/^\s*[-•]\s/, ""))}</span></li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CopilotChat({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { turns, busy, ask, stop, clear, meta } = useChat();
  const status = useCopilotStatus();
  const draft = useUi((s) => s.copilotDraft);
  const recent = useVerdictSummaries(30);
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const lastReject = recent.data?.find((v) => v.decision === "REJECT");
  const suggestions = [
    "What's happening right now?",
    "Which link is under attack, and how?",
    lastReject ? `Explain #${lastReject.ledger_index}` : "What does D4 do?",
    "Forecast the links",
    "Any fraud waiting for my review?",
    "What should I do next?",
  ];
  const mode = meta?.mode ?? status.data?.mode;
  const model = meta?.model ?? status.data?.model;

  useEffect(() => {
    if (draft && input.current) { input.current.value = draft; input.current.focus(); }
  }, [draft]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const send = () => {
    const q = input.current?.value ?? "";
    if (!q.trim()) return;
    void ask(q);
    if (input.current) input.current.value = "";
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold", mode === "claude" ? "bg-violet/12 text-violet" : "bg-brand-2/12 text-brand-2")}>
            <Bot size={14} /> {mode === "claude" ? `Claude · ${model}` : status.error ? "service offline" : "Offline analyst"}
          </span>
          <span className="inline-flex items-center gap-1 font-mono text-[11.5px] uppercase tracking-wider text-ink-3"><ShieldCheck size={13} /> advisory · not a trust decision</span>
        </div>
        {turns.length > 0 && <button className="text-ink-3 hover:text-bad" onClick={clear} title="Clear conversation"><Trash2 size={16} /></button>}
      </div>

      <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5" data-lenis-prevent>
        {turns.length === 0 && (
          <div className="py-2">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: "linear-gradient(135deg, rgb(var(--brand)), rgb(var(--violet)))" }}><Sparkles size={20} /></span>
              <div>
                <p className="text-[18px] font-bold text-ink">Ask Sentinel</p>
                <p className="text-[14px] text-ink-3">Reads the live telemetry, clusters, forecasts and the ledger. Cites every verdict it mentions.</p>
              </div>
            </div>
            <div className={cn("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => void ask(s)} className="rounded-2xl border border-line bg-surface-2 px-4 py-3 text-left text-[14.5px] font-medium text-ink-2 transition hover:-translate-y-0.5 hover:border-brand/40 hover:text-ink">{s}</button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
              className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
              {t.role === "user" ? (
                <div className="max-w-[85%] rounded-3xl rounded-br-lg px-4 py-2.5 text-[15px] font-medium text-white" style={{ background: "linear-gradient(120deg, rgb(var(--brand)), rgb(var(--brand-2)))" }}>{t.content}</div>
              ) : (
                <div className="max-w-[92%] rounded-3xl rounded-bl-lg border border-line bg-surface-2 px-4 py-3 text-[15px] leading-relaxed text-ink">
                  {t.content ? <Rich text={t.content} /> : (
                    <span className="flex gap-1.5 py-1.5">{[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-brand" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.18 }} />)}</span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="border-t border-line p-4">
        <div className="flex items-end gap-2 rounded-3xl border border-line-2 bg-surface-2 p-2 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
          <textarea ref={input} rows={1} placeholder="Ask about a verdict, a link, the forecast…" maxLength={1200}
            className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-3"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
          {busy ? (
            <button className="btn-icon !h-11 !w-11 !rounded-2xl" onClick={stop} title="Stop"><Square size={15} fill="currentColor" /></button>
          ) : (
            <button className="btn-primary !h-11 !w-11 !rounded-2xl !p-0" onClick={send} aria-label="Send"><ArrowUp size={18} /></button>
          )}
        </div>
      </div>
    </div>
  );
}
