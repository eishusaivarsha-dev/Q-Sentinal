import type { ReactNode } from "react";

/**
 * Every piece of ops-plane (machine-generated) output must sit inside this frame (spec §2.3).
 * It visually and semantically marks content as outside the trust path.
 */
export function AdvisoryFrame({ children, title = "Advisory" }: { children: ReactNode; title?: string }) {
  return (
    <section className="relative min-w-0 rounded-[10px] p-[6px]" data-advisory
      style={{ background: "repeating-linear-gradient(135deg, rgba(240,165,58,.30) 0 8px, transparent 8px 16px)", boxShadow: "inset 0 0 0 1px rgba(240,165,58,.6)" }}>
      <div className="rounded-[6px] bg-ink-800/95">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-amber/30 px-4 py-2">
          <span className="font-label text-[11px] uppercase tracking-[.22em] text-amber">◇ {title} · Advisory - not a trust decision</span>
          <span className="font-type text-[10.5px] text-paper-faint">Suggestions only. Cannot alter any verdict.</span>
        </header>
        <div className="p-4">{children}</div>
      </div>
    </section>
  );
}
