/**
 * Shared SVG defs for the illustrated layer: a boiling-ink wobble (the hand-drawn,
 * 1930s-cel line quality), brass/glass gradients, and a photon glow. Mounted once.
 */
export function InkDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <defs>
        <filter id="ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="t">
            <animate attributeName="seed" values="3;7;11;3" dur="0.6s" repeatCount="indefinite" calcMode="discrete" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="t" scale="2.2" />
        </filter>
        <filter id="ink-still" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" />
          <feDisplacementMap in="SourceGraphic" scale="1.8" />
        </filter>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-soft" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <linearGradient id="brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3c877" />
          <stop offset=".5" stopColor="#c98a2e" />
          <stop offset="1" stopColor="#7a4d17" />
        </linearGradient>
        <linearGradient id="brass-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a4d17" />
          <stop offset=".35" stopColor="#f3c877" />
          <stop offset="1" stopColor="#8a5a1c" />
        </linearGradient>
        <radialGradient id="cream" cx=".35" cy=".3" r=".8">
          <stop offset="0" stopColor="#f6ead0" />
          <stop offset="1" stopColor="#c7b089" />
        </radialGradient>
        <radialGradient id="glass" cx=".35" cy=".3" r=".75">
          <stop offset="0" stopColor="#fff6dc" stopOpacity=".35" />
          <stop offset=".6" stopColor="#f0a53a" stopOpacity=".08" />
          <stop offset="1" stopColor="#000" stopOpacity=".25" />
        </radialGradient>
        <radialGradient id="photon" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".25" stopColor="#fff1c9" />
          <stop offset=".6" stopColor="#ffc15e" stopOpacity=".5" />
          <stop offset="1" stopColor="#f0a53a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ember" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#ffd28a" />
          <stop offset=".5" stopColor="#c8502a" stopOpacity=".6" />
          <stop offset="1" stopColor="#c8502a" stopOpacity="0" />
        </radialGradient>
        <pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
          <line x1="0" y1="0" x2="0" y2="5" stroke="#0c0a07" strokeWidth="1.3" />
        </pattern>
      </defs>
    </svg>
  );
}
