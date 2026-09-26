import { cn } from "@/lib/cn";

/** Two entangled orbits around a core: the Q-SENTINEL mark. */
export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="qs-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--brand))" />
          <stop offset="1" stopColor="rgb(var(--brand-2))" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="rgb(var(--ink))" />
      <g className="origin-center animate-spin-slow" style={{ transformBox: "fill-box" }}>
        <ellipse cx="32" cy="32" rx="21" ry="8.5" fill="none" stroke="url(#qs-g)" strokeWidth="3.4" transform="rotate(-30 32 32)" />
        <ellipse cx="32" cy="32" rx="21" ry="8.5" fill="none" stroke="url(#qs-g)" strokeWidth="3.4" transform="rotate(30 32 32)" />
      </g>
      <circle cx="32" cy="32" r="5.5" fill="rgb(var(--bg))" />
    </svg>
  );
}

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[18px] font-extrabold tracking-tight text-ink">Q-SENTINEL</span>
          <span className="block font-mono text-[11px] uppercase tracking-[.18em] text-ink-3">Trust Console</span>
        </span>
      )}
    </span>
  );
}
