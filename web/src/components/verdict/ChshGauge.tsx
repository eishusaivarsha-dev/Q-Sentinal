import { motion } from "framer-motion";
import { CLASSICAL_S, TSIRELSON_S } from "@/lib/physics";
import { themeColor, useUi } from "@/state/ui";

const MAX = 3;
const A0 = -210;
const A1 = 30;
const ang = (s: number) => A0 + (Math.min(MAX, Math.max(0, s)) / MAX) * (A1 - A0);
const pt = (a: number, r: number) => [Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r] as const;
function arc(s0: number, s1: number, r: number) {
  const [x0, y0] = pt(ang(s0), r);
  const [x1, y1] = pt(ang(s1), r);
  return `M${x0} ${y0} A${r} ${r} 0 ${ang(s1) - ang(s0) > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** CHSH "Bell meter": red below the classical limit 2, green up to the quantum maximum 2√2. */
export default function ChshGauge({ S, threshold = CLASSICAL_S, size = 280 }: { S: number; threshold?: number; size?: number }) {
  useUi((s) => s.theme);
  const bad = themeColor("bad");
  const ok = themeColor("ok");
  const track = themeColor("line");
  const ink = themeColor("ink");
  const ink3 = themeColor("ink-3");
  const quantum = S > threshold;
  return (
    <div className="w-full" style={{ maxWidth: size }}>
    <svg viewBox="-122 -120 244 150" width="100%" role="img" aria-label={`CHSH S = ${S.toFixed(3)}`}>
      <path d={arc(0, MAX, 92)} stroke={track} strokeWidth={14} fill="none" strokeLinecap="round" />
      <path d={arc(0, CLASSICAL_S, 92)} stroke={bad} strokeOpacity={0.35} strokeWidth={14} fill="none" strokeLinecap="round" />
      <path d={arc(threshold, TSIRELSON_S, 92)} stroke={ok} strokeOpacity={0.35} strokeWidth={14} fill="none" />
      <motion.path d={arc(0, Math.max(0.001, Math.min(S, MAX)), 92)} stroke={quantum ? ok : bad} strokeWidth={14} fill="none" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
      {[1, 2].map((s) => {
        const [x, y] = pt(ang(s), 70);
        return <text key={s} x={x} y={y + 4} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={11} fill={ink3}>{s}</text>;
      })}
      {(() => { const [x, y] = pt(ang(TSIRELSON_S), 112); return <text x={x} y={y + 3} textAnchor="middle" fontFamily="JetBrains Mono" fontSize={9} fill={ink3}>2√2</text>; })()}
      <text x={0} y={-8} textAnchor="middle" fontFamily="JetBrains Mono" fontWeight={600} fontSize={30} fill={ink}>{S ? S.toFixed(3) : "–"}</text>
      <text x={0} y={16} textAnchor="middle" fontFamily="Manrope" fontWeight={700} fontSize={11} letterSpacing={1.5} fill={quantum ? ok : bad}>
        {S ? (quantum ? "QUANTUM · ENTANGLED" : "CLASSICAL · TAMPERED") : "NO DATA"}
      </text>
    </svg>
    <div className="data -mt-1 text-center text-[12.5px] text-ink-3">classical limit S = 2 · quantum max 2√2 ≈ 2.83</div>
    </div>
  );
}
