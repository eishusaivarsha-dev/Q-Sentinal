import { useId } from 'react';

/** Indicator bulb in an inked brass bezel. */
export function Lamp({ on, color = '#ffc15e', size = 14, pulse }: { on: boolean; color?: string; size?: number; pulse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="-10 -10 20 20" aria-hidden className={pulse && on ? 'animate-flicker' : ''}>
      {on && <circle r={9} fill={color} opacity={0.35} filter="url(#glow-soft)" />}
      <circle r={8.5} fill="url(#brass)" stroke="#0c0a07" strokeWidth={1.5} />
      <circle r={5.5} fill={on ? color : '#2a241a'} stroke="#0c0a07" strokeWidth={1.2} />
      <circle cx={-1.8} cy={-1.8} r={1.6} fill="#fff" opacity={on ? 0.8 : 0.15} />
    </svg>
  );
}

/** A glowing vacuum tube — the filament brightness tracks `level` (0..1). */
export function VacuumTube({ level = 0.7, width = 44, className }: { level?: number; width?: number; className?: string }) {
  return (
    <svg viewBox="0 0 60 110" width={width} className={className} aria-hidden>
      <ellipse cx={30} cy={48} rx={26} ry={34} fill="#ffc15e" opacity={0.25 * level} filter="url(#glow-soft)" />
      <g filter="url(#ink-still)">
        <path d="M10 88 V40 C10 14 50 14 50 40 V88 Z" fill="#1b150d" stroke="#0c0a07" strokeWidth={3} />
        <path d="M10 88 V40 C10 14 50 14 50 40 V88 Z" fill="url(#glass)" />
        <path d="M22 80 V42 M38 80 V42" stroke="#6b4a22" strokeWidth={2.2} />
        <rect x={18} y={40} width={24} height={30} rx={3} fill="none" stroke="#8a5a1c" strokeWidth={2} />
        <path d="M24 66 L27 50 L30 64 L33 48 L36 66" fill="none" stroke="#fff1c9" strokeWidth={2} strokeLinejoin="round"
          opacity={0.35 + 0.65 * level} filter="url(#glow)" className="animate-flicker" />
        <path d="M16 36 C16 26 24 22 30 22" stroke="#fff6dc" strokeOpacity={0.5} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <rect x={6} y={86} width={48} height={16} rx={3} fill="url(#brass)" stroke="#0c0a07" strokeWidth={3} />
        <path d="M12 94 H48" stroke="#0c0a07" strokeWidth={1.5} opacity={0.5} />
      </g>
    </svg>
  );
}

/** Rubber stamp — the verdict banner's physical metaphor. Text comes from props only. */
export function Stamp({ text, color, sub, animate = true }: { text: string; color: string; sub?: string; animate?: boolean }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 260 110" className={`w-full max-w-[260px] ${animate ? 'animate-stamp' : ''}`} style={{ transform: 'rotate(-7deg)' }} aria-label={text}>
      <defs>
        <filter id={`rough-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" result="n" />
          <feColorMatrix in="n" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.35" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#rough-${id})`} fill="none" stroke={color}>
        <rect x={6} y={6} width={248} height={98} rx={10} strokeWidth={6} />
        <rect x={16} y={16} width={228} height={78} rx={5} strokeWidth={2} />
        <text x={130} y={sub ? 62 : 70} textAnchor="middle" fill={color} stroke="none" fontFamily="Oswald" fontWeight={600} fontSize={42} letterSpacing={5}>{text}</text>
        {sub && <text x={130} y={84} textAnchor="middle" fill={color} stroke="none" fontFamily="Special Elite" fontSize={12} letterSpacing={2}>{sub}</text>}
      </g>
    </svg>
  );
}

/** Tiny round CRT oscilloscope: renders a trace from values in 0..1. */
export function Oscilloscope({ values, width = 180, height = 110, color = '#ffc15e', label }: { values: number[]; width?: number; height?: number; color?: string; label?: string }) {
  const w = 160, h = 80;
  const pts = values.length > 1 ? values : [0.5, 0.5];
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${10 + (i / (pts.length - 1)) * (w - 20)} ${h - 8 - Math.min(1, Math.max(0, v)) * (h - 16)}`).join(' ');
  return (
    <svg viewBox="0 0 180 110" width={width} height={height} aria-hidden>
      <g filter="url(#ink-still)">
        <rect x={2} y={2} width={176} height={106} rx={16} fill="url(#brass)" stroke="#0c0a07" strokeWidth={3} />
        <rect x={10} y={10} width={w} height={h + 2} rx={12} fill="#0f0c07" stroke="#0c0a07" strokeWidth={3} />
        <circle cx={30} cy={100} r={4} fill="#2a1d0c" stroke="#0c0a07" strokeWidth={1.5} />
        <circle cx={150} cy={100} r={4} fill="#2a1d0c" stroke="#0c0a07" strokeWidth={1.5} />
      </g>
      <g transform="translate(10 10)">
        {Array.from({ length: 7 }, (_, i) => <line key={`v${i}`} x1={(i + 1) * (w / 8)} y1={4} x2={(i + 1) * (w / 8)} y2={h - 2} stroke={color} strokeOpacity={0.08} />)}
        {Array.from({ length: 3 }, (_, i) => <line key={`h${i}`} x1={4} y1={(i + 1) * (h / 4)} x2={w - 4} y2={(i + 1) * (h / 4)} stroke={color} strokeOpacity={0.08} />)}
        <path d={d} fill="none" stroke={color} strokeWidth={1.8} filter="url(#glow)" strokeLinejoin="round" />
        <rect width={w} height={h + 2} rx={12} className="scanlines" fill="url(#glass)" opacity={0.5} />
      </g>
      {label && <text x={90} y={103} textAnchor="middle" fontFamily="Oswald" fontSize={8} letterSpacing={2} fill="#1a1208">{label}</text>}
    </svg>
  );
}

/** Heavy toggle switch, the Attack Lab arming lever. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="group flex items-center gap-3">
      <svg width={34} height={48} viewBox="0 0 34 48" aria-hidden>
        <g filter="url(#ink-still)">
          <rect x={3} y={10} width={28} height={28} rx={6} fill="url(#brass)" stroke="#0c0a07" strokeWidth={2.5} />
          <circle cx={17} cy={24} r={6} fill="#1b150d" stroke="#0c0a07" strokeWidth={2} />
          <g style={{ transition: 'transform .18s cubic-bezier(.3,1.6,.5,1)', transform: `rotate(${on ? -28 : 28}deg)`, transformOrigin: '17px 24px' }}>
            <rect x={14} y={2} width={6} height={22} rx={3} fill="#e9dcc0" stroke="#0c0a07" strokeWidth={2} />
            <circle cx={17} cy={4} r={4.5} fill={on ? '#e0513a' : '#7a6b52'} stroke="#0c0a07" strokeWidth={2} />
          </g>
        </g>
      </svg>
      <span className="label group-hover:text-amber">{label}: <span className={on ? 'text-amber' : ''}>{on ? 'ARMED' : 'SAFE'}</span></span>
    </button>
  );
}
