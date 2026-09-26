// Design-system primitives. Every colour comes from the theme tokens in index.css.
import { motion } from "framer-motion";
import {
  AlertTriangle, BadgeCheck, Dice5, Ear, Eye, KeyRound, Link2, Lock, Repeat, Recycle, ShieldCheck, ShieldX, Vault, VenetianMask, ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";
import { useId, type ReactNode } from "react";
import { errorText } from "@/api/client";
import type { Decision, Severity } from "@/api/types";
import type { AttackClass, AttackGlyphName } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import BorderGlow from "@/fx/BorderGlow";
import { CountUp, Reveal } from "@/fx/motion";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";

const TONE: Record<Tone, string> = {
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/35 bg-warn/10 text-warn",
  bad: "border-bad/35 bg-bad/10 text-bad",
  info: "border-brand-2/35 bg-brand-2/10 text-brand-2",
  brand: "border-brand/30 bg-brand/10 text-brand",
  neutral: "border-line-2 bg-surface-2 text-ink-2",
};
export const toneText: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", info: "text-brand-2", brand: "text-brand", neutral: "text-ink" };

export function Chip({ tone = "neutral", children, className, dot }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean }) {
  return (
    <span className={cn("chip", TONE[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function DecisionBadge({ decision, size = "sm" }: { decision: Decision | string; size?: "sm" | "lg" }) {
  const ok = decision === "ACCEPT";
  const Icon = ok ? ShieldCheck : ShieldX;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full font-bold tracking-wide", ok ? "bg-ok/12 text-ok" : "bg-bad/12 text-bad",
      size === "lg" ? "px-4 py-1.5 text-[16px]" : "px-2.5 py-0.5 text-[13px]")}>
      <Icon size={size === "lg" ? 18 : 14} strokeWidth={2.4} />{decision}
    </span>
  );
}

export function DetectorChip({ id, severity }: { id: string; severity: Severity | string }) {
  const tone: Tone = severity === "critical" ? "bad" : severity === "warning" ? "warn" : "neutral";
  return <Chip tone={tone} className="data !text-[12px]">{id}</Chip>;
}

export function ClassChip({ cls }: { cls: AttackClass }) {
  const tone: Tone = cls.tone === "bad" ? "bad" : cls.tone === "warn" ? "warn" : cls.tone === "ok" ? "ok" : "info";
  return <Chip tone={tone} dot>{cls.label}</Chip>;
}

export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-ok/30 bg-ok/10 px-3 py-1 text-[13px] font-bold text-ok">
      <BadgeCheck size={15} /> AI in trust path: NO
    </span>
  );
}

const GLYPH: Record<AttackGlyphName, LucideIcon> = {
  badge: BadgeCheck, dice: Dice5, key: KeyRound, eye: Eye, link: Link2, ear: Ear, loop: Repeat, recycle: Recycle,
  swap: ArrowLeftRight, mask: VenetianMask, lock: Lock, safe: Vault,
};

export function AttackIcon({ glyph, size = 44, tone = "brand" }: { glyph: AttackGlyphName; size?: number; tone?: Tone }) {
  const Icon = GLYPH[glyph] ?? AlertTriangle;
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-2xl border", TONE[tone])} style={{ width: size, height: size }}>
      <Icon size={size * 0.48} strokeWidth={2} />
    </span>
  );
}

/** Standard content card. `glow` swaps in the React Bits BorderGlow edge light. */
export function Card({ title, sub, icon: Icon, actions, children, className, bodyClass, glow, tone }: {
  title?: ReactNode; sub?: ReactNode; icon?: LucideIcon; actions?: ReactNode; children?: ReactNode; className?: string; bodyClass?: string;
  glow?: boolean; tone?: "bad" | "warn";
}) {
  const head = (title || actions) && (
    <header className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon size={18} /></span>}
        <div className="min-w-0">
          {title && <h3 className="truncate text-[18px] font-bold leading-tight text-ink">{title}</h3>}
          {sub && <p className="data truncate text-[13px] text-ink-3">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
  const body = <div className={cn("p-6", Boolean(title || actions) && "pt-4", bodyClass)}>{children}</div>;
  const toneRing = tone === "bad" ? "ring-2 ring-bad/40" : tone === "warn" ? "ring-2 ring-warn/40" : "";
  if (glow) {
    return (
      <BorderGlow className={cn(toneRing, className)} innerClassName="min-w-0">
        {head}
        {body}
      </BorderGlow>
    );
  }
  return (
    <section className={cn("card", toneRing, className)}>
      {head}
      {body}
    </section>
  );
}

export function PageHeader({ eyebrow, title, accent, lede, right }: { eyebrow: string; title: string; accent?: string; lede?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
      <Reveal className="min-w-0 max-w-3xl" y={16}>
        <div className="eyebrow mb-3">{eyebrow}</div>
        <h1 className="text-[40px] font-extrabold leading-[1.05] text-ink md:text-[52px]">
          {title}{accent && <> <span className="font-serif text-[1.08em] font-normal italic text-gradient">{accent}</span></>}
        </h1>
        {lede && <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">{lede}</p>}
      </Reveal>
      {right && <div className="no-print flex flex-wrap items-center gap-3">{right}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone, icon: Icon, format }: {
  label: string; value: number | string | undefined; sub?: ReactNode; tone?: Tone; icon?: LucideIcon; format?: (v: number) => string;
}) {
  return (
    <div className="card card-hover p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="label">{label}</span>
        {Icon && <Icon size={18} className={tone ? toneText[tone] : "text-ink-3"} />}
      </div>
      <div className={cn("data mt-2 text-[34px] font-semibold leading-none tracking-tight", tone ? toneText[tone] : "text-ink")}>
        {typeof value === "number" ? <CountUp value={value} format={format} /> : value ?? "–"}
      </div>
      {sub && <div className="mt-2 text-[14px] text-ink-3">{sub}</div>}
    </div>
  );
}

export function Empty({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-line-2 bg-surface-2/60 px-6 py-10 text-center text-[15px] text-ink-3">
      {Icon && <Icon size={26} className="text-ink-3" />}
      <div>{children}</div>
    </div>
  );
}

export function ErrorNote({ error, hint }: { error: unknown; hint?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-bad/30 bg-bad/8 p-4 text-[15px]">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-bad" />
      <div className="min-w-0">
        <p className="font-semibold text-bad">{errorText(error)}</p>
        {hint && <p className="data mt-1 break-all text-[13px] text-ink-3">{hint}</p>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-xl bg-[linear-gradient(90deg,rgb(var(--surface-2)),rgb(var(--line)),rgb(var(--surface-2)))] bg-[length:200%_100%]", className)} />;
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  const id = useId();
  return (
    <div className="inline-flex rounded-full border border-line bg-surface p-1 shadow-card">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)} className={cn("relative rounded-full px-4 py-1.5 text-[15px] font-semibold transition-colors", value === v ? "text-white" : "text-ink-2 hover:text-ink")}>
          {value === v && <motion.span layoutId={`tab-${id}`} className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(120deg, rgb(var(--brand)), rgb(var(--brand-2)))" }} transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
          <span className="relative">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format = (v: number) => String(v) }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-semibold text-ink-2">{label}</span>
        <span className="data text-[15px] font-semibold text-brand">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full accent-[rgb(var(--brand))]"
        style={{ background: `linear-gradient(90deg, rgb(var(--brand)) ${pct}%, rgb(var(--line)) ${pct}%)` }} />
    </label>
  );
}

export function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="group flex items-center gap-3 text-left">
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-brand" : "bg-line-2")}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow", on ? "right-1" : "left-1")} />
      </span>
      <span>
        <span className="block text-[15px] font-semibold text-ink">{label}</span>
        {sub && <span className="block text-[13px] text-ink-3">{sub}</span>}
      </span>
    </button>
  );
}

/** Horizontal meter with an optional threshold tick. */
export function Meter({ value, max = 1, threshold, tone = "brand", height = 10 }: { value: number; max?: number; threshold?: number; tone?: Tone; height?: number }) {
  const w = (x: number) => `${Math.max(0, Math.min(100, (x / max) * 100))}%`;
  const bar = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad", info: "bg-brand-2", brand: "bg-brand", neutral: "bg-ink-3" }[tone];
  return (
    <div className="relative w-full rounded-full bg-line/70" style={{ height }}>
      <motion.div className={cn("h-full rounded-full", bar)} initial={{ width: 0 }} animate={{ width: w(value) }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
      {threshold !== undefined && <div className="absolute -top-1 w-[2px] rounded bg-ink" style={{ left: w(threshold), height: height + 8 }} title="threshold" />}
    </div>
  );
}

export function KeyVal({ items, cols = 2 }: { items: [string, ReactNode][]; cols?: 2 | 3 | 4 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="label !text-[12px]">{k}</dt>
          <dd className="data mt-0.5 truncate text-[15px] text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
