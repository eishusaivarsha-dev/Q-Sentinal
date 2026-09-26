const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const KETS = ['|0⟩', '|+⟩', '|1⟩', '|−⟩', '|i⟩', '|−i⟩'];

interface Props {
  size?: number;
  spin?: boolean;
  /** amount of "quantum growth" leaking out of the rotor, 0..1 */
  quantum?: number;
  className?: string;
}

/** An Enigma-style cipher rotor, drawn in thick ink, with photon light seeping from its core. */
export function CipherWheel({ size = 320, spin = true, quantum = 0.7, className }: Props) {
  const r = 150;
  return (
    <svg viewBox="-170 -170 340 340" width={size} height={size} className={className} aria-hidden>
      {/* photon bloom behind */}
      <circle r={70 + 40 * quantum} fill="url(#photon)" opacity={0.35 * quantum} filter="url(#glow-soft)" />
      <g filter="url(#ink-still)">
        {/* outer toothed ring */}
        <g className={spin ? 'origin-center animate-spin-slow' : ''} style={{ transformBox: 'fill-box' }}>
          {Array.from({ length: 52 }, (_, i) => (
            <rect key={i} x={-5} y={-r - 12} width={10} height={16} rx={2} fill="url(#brass)" stroke="#0c0a07" strokeWidth={2.5}
              transform={`rotate(${(i * 360) / 52})`} />
          ))}
          <circle r={r} fill="url(#brass)" stroke="#0c0a07" strokeWidth={4} />
          <circle r={r - 14} fill="#1b150d" stroke="#0c0a07" strokeWidth={3} />
          {ALPHA.map((c, i) => (
            <g key={c} transform={`rotate(${(i * 360) / 26}) translate(0 ${-(r - 30)})`}>
              <text textAnchor="middle" dominantBaseline="middle" fontFamily="Oswald" fontSize={15} fill="#e9dcc0">{c}</text>
            </g>
          ))}
          <circle r={r - 46} fill="none" stroke="#e9dcc0" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 5" />
        </g>
        {/* counter-rotating inner ring of quantum states */}
        <g className={spin ? 'origin-center animate-spin-slower' : ''} style={{ transformBox: 'fill-box' }}>
          <circle r={r - 52} fill="url(#cream)" stroke="#0c0a07" strokeWidth={3.5} />
          {KETS.map((k, i) => (
            <text key={k} transform={`rotate(${i * 60}) translate(0 ${-(r - 72)})`} textAnchor="middle" dominantBaseline="middle"
              fontFamily="DM Serif Display" fontSize={16} fill="#2a1d0c">{k}</text>
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={0} y1={-30} x2={0} y2={-(r - 90)} stroke="#2a1d0c" strokeWidth={2.5} transform={`rotate(${i * 60 + 30})`} />
          ))}
        </g>
        {/* hub */}
        <circle r={30} fill="#1b150d" stroke="#0c0a07" strokeWidth={4} />
        <circle r={30} fill="url(#glass)" />
        <path d="M-22 -10 A 24 24 0 0 1 -6 -24" stroke="#fff6dc" strokeOpacity={0.6} strokeWidth={3} fill="none" strokeLinecap="round" />
      </g>
      {/* the quantum core — clean, glowing, un-inked */}
      <circle r={9} fill="url(#photon)" filter="url(#glow)">
        <animate attributeName="r" values="8;11;8" dur="2.8s" repeatCount="indefinite" />
      </circle>
      {quantum > 0 && Array.from({ length: 3 }, (_, i) => (
        <ellipse key={i} rx={22 + i * 3} ry={7} fill="none" stroke="#ffc15e" strokeOpacity={0.55} strokeWidth={1}
          transform={`rotate(${i * 60})`}>
          <animateTransform attributeName="transform" type="rotate" from={`${i * 60}`} to={`${i * 60 + 360}`} dur={`${6 + i * 2}s`} repeatCount="indefinite" />
        </ellipse>
      ))}
    </svg>
  );
}
