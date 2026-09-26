export type AttackGlyphName = 'dice' | 'key' | 'eye' | 'link' | 'ear' | 'loop' | 'recycle' | 'swap' | 'mask' | 'badge' | 'lock' | 'safe';

const S = { stroke: '#0c0a07', strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

/** Inked emblem for each attack class — engraved-medallion style. */
export function AttackGlyph({ glyph, size = 56, hot }: { glyph: AttackGlyphName; size?: number; hot?: boolean }) {
  return (
    <svg viewBox="-32 -32 64 64" width={size} height={size} style={{ flexShrink: 0 }} aria-hidden>
      {hot && <circle r={30} fill="url(#ember)" filter="url(#glow-soft)" />}
      <g filter="url(#ink-still)">
        <circle r={27} fill="url(#brass)" {...S} />
        <circle r={21} fill="#1b150d" {...S} strokeWidth={2} />
        <g transform="scale(.9)">{BODY[glyph]}</g>
      </g>
    </svg>
  );
}

const cream = '#e9dcc0';
const amber = '#ffc15e';

const BODY: Record<AttackGlyphName, JSX.Element> = {
  dice: (<g><rect x={-12} y={-12} width={24} height={24} rx={5} fill={cream} {...S} transform="rotate(12)" />{[[-5, -5], [5, 5], [0, 0], [5, -5], [-5, 5]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={2.2} fill="#0c0a07" transform="rotate(12)" />)}</g>),
  key: (<g><circle cx={-8} cy={0} r={7} fill={amber} {...S} /><circle cx={-8} cy={0} r={2.5} fill="#1b150d" /><path d="M-1 0 H15 M10 0 V6 M14 0 V5" fill="none" {...S} stroke={cream} strokeWidth={3.5} /></g>),
  eye: (<g><path d="M-16 0 C-8 -11 8 -11 16 0 C8 11 -8 11 -16 0 Z" fill={cream} {...S} /><circle r={5.5} fill={amber} {...S} strokeWidth={2} /><circle r={2} fill="#0c0a07" /></g>),
  link: (<g><rect x={-15} y={-6} width={17} height={12} rx={6} fill="none" {...S} stroke={cream} strokeWidth={3.5} transform="rotate(-30)" /><rect x={-2} y={-6} width={17} height={12} rx={6} fill="none" {...S} stroke={amber} strokeWidth={3.5} transform="rotate(-30)" /></g>),
  ear: (<g><path d="M-6 12 C-14 8 -12 -14 2 -14 C12 -14 14 -4 8 2 C4 6 4 10 0 13 C-2 14 -4 13 -6 12 Z" fill={cream} {...S} /><path d="M-2 -6 C4 -8 6 -2 2 1" fill="none" {...S} strokeWidth={2} /><path d="M12 -12 q4 4 0 8 M16 -15 q6 7 0 14" fill="none" stroke={amber} strokeWidth={2} /></g>),
  loop: (<g><path d="M-12 4 A12 12 0 1 1 4 12" fill="none" {...S} stroke={cream} strokeWidth={4} /><path d="M-2 8 L5 13 L-1 18" fill="none" {...S} stroke={amber} strokeWidth={3.5} /></g>),
  recycle: (<g>{[0, 120, 240].map((r) => <path key={r} d="M-4 -13 L6 -13 L10 -6" fill="none" {...S} stroke={r === 0 ? amber : cream} strokeWidth={3.5} transform={`rotate(${r})`} />)}</g>),
  swap: (<g><path d="M-13 -5 H11 M5 -11 L11 -5 L5 1" fill="none" {...S} stroke={cream} strokeWidth={3.5} /><path d="M13 7 H-11 M-5 1 L-11 7 L-5 13" fill="none" {...S} stroke={amber} strokeWidth={3.5} /></g>),
  mask: (<g><path d="M-15 -6 C-15 -12 15 -12 15 -6 C15 6 6 12 0 8 C-6 12 -15 6 -15 -6 Z" fill={cream} {...S} /><ellipse cx={-6} cy={-3} rx={3.5} ry={2.5} fill="#0c0a07" /><ellipse cx={6} cy={-3} rx={3.5} ry={2.5} fill="#0c0a07" /></g>),
  badge: (<g><path d="M0 -15 L12 -9 V2 C12 9 6 13 0 15 C-6 13 -12 9 -12 2 V-9 Z" fill={amber} {...S} /><text y={5} textAnchor="middle" fontFamily="Oswald" fontSize={13} fill="#0c0a07">?</text></g>),
  lock: (<g><rect x={-11} y={-3} width={22} height={17} rx={3} fill={amber} {...S} /><path d="M-6 -3 V-8 A6 6 0 0 1 6 -8 V-3" fill="none" {...S} stroke={cream} strokeWidth={3.5} /><circle cy={5} r={2.5} fill="#0c0a07" /></g>),
  safe: (<g><rect x={-14} y={-13} width={28} height={26} rx={3} fill={cream} {...S} /><circle r={7} fill={amber} {...S} strokeWidth={2} /><path d="M0 -7 V-3 M0 3 V7 M-7 0 H-3 M3 0 H7" stroke="#0c0a07" strokeWidth={1.5} /></g>),
};
