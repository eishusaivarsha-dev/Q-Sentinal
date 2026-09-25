import type { Rates } from "../api/types";
import { ellipsoidAxes } from "../lib/physics";

/** 2-D side view (X horizontal, Z vertical) for small cards. */
export default function EllipseThumb({ rates, baseline, size = 88 }: { rates: Rates | null; baseline: Rates | null; size?: number }) {
  const a = ellipsoidAxes(rates);
  const g = ellipsoidAxes(baseline);
  const r = size / 2 - 6;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Channel shape (side view)">
      <ellipse cx={size / 2} cy={size / 2} rx={g.x * r} ry={g.z * r} fill="none" stroke="#64748b" strokeDasharray="4 4" />
      <ellipse cx={size / 2} cy={size / 2} rx={a.x * r} ry={a.z * r} fill="rgba(34,211,238,0.3)" stroke="#22d3ee" strokeWidth={2} />
      <line x1={size / 2} y1={4} x2={size / 2} y2={size - 4} stroke="#38bdf8" strokeOpacity={0.6} />
    </svg>
  );
}
