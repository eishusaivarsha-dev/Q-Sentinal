import { CLASSICAL_S, TSIRELSON_S } from '@/lib/physics';

const MAX = 3;
const A0 = -200, A1 = 20; // sweep in degrees
const ang = (s: number) => A0 + (Math.min(MAX, Math.max(0, s)) / MAX) * (A1 - A0);
const pt = (a: number, r: number) => [Math.cos((a * Math.PI) / 180) * r, Math.sin((a * Math.PI) / 180) * r] as const;
function arc(s0: number, s1: number, r: number) {
  const [x0, y0] = pt(ang(s0), r); const [x1, y1] = pt(ang(s1), r);
  return `M${x0} ${y0} A${r} ${r} 0 ${ang(s1) - ang(s0) > 180 ? 1 : 0} 1 ${x1} ${y1}`;
}

/** Analog Bell meter. Red below the classical limit, hatched past Tsirelson (physically impossible). */
export function ChshGauge({ S, sigma = 0, threshold = CLASSICAL_S, size = 260 }: { S: number; sigma?: number; threshold?: number; size?: number }) {
  const needle = ang(S);
  return (
    <svg viewBox="-130 -125 260 175" width="100%" style={{ maxWidth: size }} role="img" aria-label={`CHSH S = ${S.toFixed(3)}`}>
      <g filter="url(#ink-still)">
        <path d="M-122 40 A 122 122 0 1 1 122 40 Z" fill="url(#brass)" stroke="#0c0a07" strokeWidth={4} transform="translate(0 -6)" />
        <path d="M-108 34 A 108 108 0 1 1 108 34 Z" fill="url(#cream)" stroke="#0c0a07" strokeWidth={3} transform="translate(0 -6)" />
      </g>
      <g transform="translate(0 -6)">
        <path d={arc(0, CLASSICAL_S, 88)} stroke="#c8502a" strokeWidth={12} fill="none" opacity={0.85} />
        <path d={arc(CLASSICAL_S, threshold, 88)} stroke="#e39a3a" strokeWidth={12} fill="none" opacity={0.85} />
        <path d={arc(threshold, TSIRELSON_S, 88)} stroke="#7a9a44" strokeWidth={12} fill="none" opacity={0.9} />
        <path d={arc(TSIRELSON_S, MAX, 88)} stroke="url(#hatch)" strokeWidth={12} fill="none" />
        {Array.from({ length: 31 }, (_, i) => {
          const s = i / 10; const a = ang(s); const major = i % 5 === 0;
          const [x0, y0] = pt(a, major ? 70 : 75); const [x1, y1] = pt(a, 81);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#1a1208" strokeWidth={major ? 2.2 : 1} />;
        })}
        {[0, 0.5, 1, 1.5, 2, 2.5, 3].map((s) => {
          const [x, y] = pt(ang(s), 58);
          return <text key={s} x={x} y={y + 4} textAnchor="middle" fontFamily="Oswald" fontSize={11} fill="#1a1208">{s}</text>;
        })}
        {(() => { const [x, y] = pt(ang(TSIRELSON_S), 100); return <text x={x} y={y} textAnchor="middle" fontFamily="Special Elite" fontSize={8} fill="#1a1208">2√2</text>; })()}
        <text x={-52} y={20} textAnchor="middle" fontFamily="Oswald" fontSize={8} letterSpacing={1.5} fill="#8e3219">CLASSICAL</text>
        <text x={52} y={20} textAnchor="middle" fontFamily="Oswald" fontSize={8} letterSpacing={1.5} fill="#3d5a1c">QUANTUM</text>
        {/* uncertainty band */}
        {sigma > 0 && <path d={arc(Math.max(0, S - sigma), Math.min(MAX, S + sigma), 96)} stroke="#1a1208" strokeWidth={3} fill="none" opacity={0.5} />}
        {/* needle */}
        <g style={{ transform: `rotate(${needle}deg)`, transformOrigin: '0px 0px', transition: 'transform .9s cubic-bezier(.3,1.5,.5,1)' }}>
          <path d="M-10 -3 L92 0 L-10 3 Z" fill="#1a1208" stroke="#0c0a07" strokeWidth={1.5} />
          <path d="M60 -1.2 L92 0 L60 1.2 Z" fill="#c8502a" />
        </g>
        <circle r={9} fill="url(#brass)" stroke="#0c0a07" strokeWidth={2.5} />
      </g>
      <text x={0} y={42} textAnchor="middle" fontFamily="IBM Plex Mono" fontSize={17} fill="#ffc15e" style={{ filter: 'drop-shadow(0 0 6px rgba(255,193,94,.6))' }}>
        S = {S.toFixed(3)}{sigma ? ` ± ${sigma.toFixed(3)}` : ''}
      </text>
    </svg>
  );
}
