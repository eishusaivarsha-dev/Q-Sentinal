// Shared building blocks of the Trust Console's visual language.
import type { ReactNode } from "react";
import { errorText } from "@/api/client";
import type { Decision, Severity } from "@/api/types";
import type { AttackClass, Tone } from "@/lib/attribution";

export function Panel({ title, code, actions, children, className = "", bodyClass = "p-5" }: {
  title?: ReactNode; code?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="panel-head pl-6 pr-6">
          <div className="flex min-w-0 items-baseline gap-3">
            {title && <h2 className="panel-title truncate">{title}</h2>}
            {code && <span className="panel-code hidden sm:inline">{code}</span>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function PageHeader({ directive, title, lede, right }: { directive: string; title: string; lede?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        <div className="eyebrow mb-2 flex items-center gap-3"><span className="inline-block h-px w-8 bg-amber/60" />{directive}</div>
        <h1 className="font-display text-[34px] leading-[1.05] text-paper md:text-[46px]">{title}</h1>
        {lede && <p className="mt-3 max-w-2xl font-mono text-[13px] leading-relaxed text-paper-dim">{lede}</p>}
      </div>
      {right}
    </div>
  );
}

const TONE: Record<Tone | "neutral", string> = {
  ok: "border-accept/60 bg-accept/10 text-accept",
  bad: "border-reject/70 bg-reject/15 text-[#ff9f8f]",
  warn: "border-amber/60 bg-amber/10 text-amber-hot",
  info: "border-verdigris/50 bg-verdigris/10 text-verdigris",
  neutral: "border-paper-mute/40 text-paper-faint",
};

export function Chip({ children, tone = "neutral", className = "", title }: { children: ReactNode; tone?: Tone | "neutral"; className?: string; title?: string }) {
  return <span title={title} className={`chip ${TONE[tone]} ${className}`}>{children}</span>;
}

/** Renders `decision` verbatim - the console never derives it. */
export function DecisionBadge({ decision, className = "" }: { decision: Decision | string; className?: string }) {
  return <Chip tone={decision === "ACCEPT" ? "ok" : "bad"} className={className}>{decision === "ACCEPT" ? "✓" : "✕"} {decision}</Chip>;
}

export function ClassChip({ cls, className = "" }: { cls: AttackClass; className?: string }) {
  return <Chip tone={cls.tone} className={className}>{cls.tone === "ok" ? "○" : "◆"} {cls.label}</Chip>;
}

export const severityTone = (s: Severity | string): Tone => (s === "critical" ? "bad" : s === "warning" ? "warn" : "ok");

export function DetectorChip({ id, severity }: { id: string; severity: Severity | string }) {
  return <Chip tone={severityTone(severity)} className="data !tracking-normal">{id}</Chip>;
}

/** Always-visible trust-boundary statement. */
export function AiBadge({ value = false }: { value?: boolean }) {
  return (
    <span className="plate shrink-0" title="No machine-learning model participates in any ACCEPT / REJECT decision.">
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><circle cx="5" cy="5" r="4" fill={value ? "#8e3219" : "#2d5a1f"} stroke="#1a1208" /></svg>
      AI in trust path: {value ? "YES" : "NO"}
    </span>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone | "amber" }) {
  const color = tone === "bad" ? "text-reject" : tone === "warn" ? "text-amber-hot" : tone === "ok" ? "text-accept" : tone === "amber" ? "phosphor" : "text-paper";
  return (
    <div className="panel min-w-0 p-4 pt-6">
      <div className="label mb-1">{label}</div>
      <div className={`data text-[26px] leading-none ${color}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11px] text-paper-faint">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[110px] items-center justify-center px-4 text-center font-type text-[13px] text-paper-faint">{children}</div>;
}

export function ErrorNote({ error, hint }: { error: unknown; hint?: ReactNode }) {
  return (
    <div className="rounded-md border border-reject/50 bg-reject/10 p-3 text-[12.5px] text-[#ffb3a6]">
      <span className="font-label uppercase tracking-[.16em]">Machine fault · </span>{errorText(error)}
      {hint && <div className="mt-1 text-paper-faint">{hint}</div>}
    </div>
  );
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string;
}) {
  return (
    <label className="block">
      <span className="flex justify-between gap-2"><span className="label">{label}</span><span className="data text-amber">{format ? format(value) : value}</span></span>
      <input type="range" className="slider mt-2 w-full" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} style={{ ["--p" as string]: `${((value - min) / (max - min)) * 100}%` }} />
    </label>
  );
}

export function Tabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-md border hair p-1">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)}
          className={`rounded px-4 py-1.5 font-label text-[11px] uppercase tracking-[.18em] ${value === k ? "bg-amber text-ink" : "text-paper-faint hover:text-paper"}`}>{label}</button>
      ))}
    </div>
  );
}

export function LinkText({ children }: { children: ReactNode }) {
  return <span className="font-label text-[11px] uppercase tracking-[.18em] text-amber hover:underline">{children}</span>;
}
