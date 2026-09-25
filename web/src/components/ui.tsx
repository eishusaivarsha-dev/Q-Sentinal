import type { ReactNode } from "react";
import { errorText } from "../api/client";
import type { Tone } from "../lib/attribution";

export function Card({ title, right, children, className = "" }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-slate-800 bg-slate-900/80 p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-semibold text-slate-100">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const toneClass: Record<Tone | "neutral", string> = {
  ok: "bg-emerald-900/70 text-emerald-300 border-emerald-700",
  bad: "bg-rose-900/70 text-rose-200 border-rose-700",
  warn: "bg-amber-900/60 text-amber-200 border-amber-700",
  info: "bg-sky-900/60 text-sky-200 border-sky-700",
  neutral: "bg-slate-800 text-slate-300 border-slate-700",
};

export function Pill({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone | "neutral"; className?: string }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${toneClass[tone]} ${className}`}>{children}</span>;
}

export function DecisionPill({ decision }: { decision: string }) {
  return <Pill tone={decision === "ACCEPT" ? "ok" : "bad"}>{decision}</Pill>;
}

export function severityTone(s: string): Tone {
  return s === "critical" ? "bad" : s === "warning" ? "warn" : "ok";
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  const color = tone === "bad" ? "text-rose-300" : tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-emerald-300" : "text-slate-100";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-3xl font-semibold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function ErrorNote({ error, hint }: { error: unknown; hint?: ReactNode }) {
  return (
    <div className="rounded-lg border border-rose-800 bg-rose-950/50 p-3 text-sm text-rose-200">
      {errorText(error)}
      {hint && <div className="mt-1 text-rose-300/80">{hint}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Button({ children, onClick, disabled, variant = "primary", className = "", type = "button" }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary" | "danger" | "ghost" | "ok"; className?: string; type?: "button" | "submit";
}) {
  const v = {
    primary: "bg-cyan-600 hover:bg-cyan-500 text-white",
    danger: "bg-rose-600 hover:bg-rose-500 text-white",
    ok: "bg-emerald-700 hover:bg-emerald-600 text-white",
    ghost: "border border-slate-700 hover:bg-slate-800 text-slate-200",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}>
      {children}
    </button>
  );
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string;
}) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="flex justify-between"><span>{label}</span><span className="font-mono text-cyan-300">{format ? format(value) : value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-cyan-500" />
    </label>
  );
}

/** Statistic against its threshold as a small bullet gauge. */
export function Bullet({ value, threshold, max, higherIsBad = true }: { value: number; threshold: number; max: number; higherIsBad?: boolean }) {
  const w = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;
  const bad = higherIsBad ? value > threshold : value <= threshold;
  return (
    <div className="relative mt-2 h-3 rounded-full bg-slate-800">
      <div className={`h-3 rounded-full ${bad ? "bg-rose-500" : "bg-emerald-500"}`} style={{ width: w(value) }} />
      <div className="absolute top-[-4px] h-5 w-0.5 bg-amber-300" style={{ left: w(threshold) }} title={`threshold ${threshold}`} />
    </div>
  );
}

export function AdvisoryFrame({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-amber-500/70 p-1" style={{ background: "repeating-linear-gradient(135deg, rgba(245,158,11,0.10) 0 10px, transparent 10px 20px)" }}>
      <p className="px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-300">Advisory – not a trust decision</p>
      <div className="rounded-lg bg-slate-950/90 p-3">{children}</div>
    </div>
  );
}
