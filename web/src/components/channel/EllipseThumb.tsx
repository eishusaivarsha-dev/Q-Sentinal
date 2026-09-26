import type { Rates } from "@/api/types";
import { ellipsoidAxes } from "@/lib/physics";

/** 2-D side view (X horizontal, Z vertical) for link cards: a small brass-rimmed porthole. */
export default function EllipseThumb({ rates, baseline, size = 88, alarm }: { rates: Rates | null; baseline: Rates | null; size?: number; alarm?: boolean }) {
  const a = ellipsoidAxes(rates);
  const g = ellipsoidAxes(baseline);
  const c = size / 2;
  const r = size / 2 - 10;
  const clamp = (x: number) => Math.max(0.02, Math.abs(x));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Channel shape (side view)" className="shrink-0">
      <circle cx={c} cy={c} r={c - 2} fill="#0f1512" stroke="#0c0a07" strokeWidth={3} />
      <circle cx={c} cy={c} r={c - 4} fill="none" stroke="url(#brass)" strokeWidth={3} />
      <ellipse cx={c} cy={c} rx={clamp(g.x) * r} ry={clamp(g.z) * r} fill="none" stroke="#8a7c62" strokeDasharray="3 3" />
      <ellipse cx={c} cy={c} rx={clamp(a.x) * r} ry={clamp(a.z) * r} fill={alarm ? "rgba(224,81,58,.28)" : "rgba(255,193,94,.25)"}
        stroke={alarm ? "#e0513a" : "#ffc15e"} strokeWidth={2} filter="url(#glow)" />
      <line x1={c} y1={8} x2={c} y2={size - 8} stroke="#38bdf8" strokeOpacity={0.5} />
      <text x={c + 3} y={14} fontSize={8} fill="#38bdf8" fontFamily="Oswald">Z</text>
    </svg>
  );
}
