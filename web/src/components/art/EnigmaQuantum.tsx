/**
 * Hero illustration: a wartime cipher machine whose plugboard has been rewired
 * into a quantum source. Photons leave the rotors, run down a braided cable and
 * settle into a bell jar holding a single qubit.
 */
export function EnigmaQuantum({ className, alarm = false }: { className?: string; alarm?: boolean }) {
  const cable = 'M200 150 C 260 150, 250 70, 320 80 S 390 150, 440 140';
  const beam = alarm ? '#e0513a' : '#ffc15e';
  return (
    <svg viewBox="0 0 540 240" className={className} role="img" aria-label="Cipher machine feeding a qubit">
      <ellipse cx={270} cy={222} rx={250} ry={10} fill="#000" opacity={0.5} />
      <g filter="url(#ink)">
        {/* machine body */}
        <path d="M20 110 L40 92 H210 L226 110 V205 H20 Z" fill="#3a2614" stroke="#0c0a07" strokeWidth={4} />
        <path d="M20 110 H226" stroke="#0c0a07" strokeWidth={3} />
        <path d="M28 118 H218 V198 H28 Z" fill="#241709" stroke="#0c0a07" strokeWidth={2.5} />
        {/* wood grain */}
        {[130, 150, 170, 188].map((y) => <path key={y} d={`M34 ${y} C 80 ${y - 4}, 140 ${y + 4}, 212 ${y - 2}`} stroke="#5a3b1c" strokeWidth={1.2} fill="none" />)}
        {/* rotors */}
        {[70, 118, 166].map((x, i) => (
          <g key={x} transform={`translate(${x} 78)`}>
            <rect x={-18} y={-26} width={36} height={40} rx={6} fill="url(#brass-h)" stroke="#0c0a07" strokeWidth={3} />
            {Array.from({ length: 5 }, (_, k) => <line key={k} x1={-18} x2={18} y1={-20 + k * 8} y2={-20 + k * 8} stroke="#0c0a07" strokeWidth={1.4} opacity={0.6} />)}
            <rect x={-8} y={-4} width={16} height={14} rx={2} fill="#e9dcc0" stroke="#0c0a07" strokeWidth={2} />
            <text y={8} textAnchor="middle" fontFamily="Oswald" fontSize={11} fill="#1a1208">{'QKD'[i]}</text>
          </g>
        ))}
        {/* lampboard */}
        {Array.from({ length: 9 }, (_, k) => (
          <circle key={k} cx={44 + k * 20} cy={132} r={6.5} fill="#1b150d" stroke="#0c0a07" strokeWidth={2} />
        ))}
        {/* keys */}
        {Array.from({ length: 16 }, (_, k) => {
          const row = Math.floor(k / 8); const col = k % 8;
          return (
            <g key={k} transform={`translate(${48 + col * 21 + row * 10} ${160 + row * 20})`}>
              <ellipse cx={0} cy={4} rx={8} ry={5} fill="#0c0a07" />
              <circle r={8} fill="url(#cream)" stroke="#0c0a07" strokeWidth={2.5} />
              <text y={3.5} textAnchor="middle" fontFamily="Oswald" fontSize={9} fill="#2a1d0c">{'QWERTZUIASDFGHJK'[k]}</text>
            </g>
          );
        })}
        {/* output jack */}
        <rect x={214} y={138} width={16} height={24} rx={3} fill="url(#brass)" stroke="#0c0a07" strokeWidth={3} />
        {/* braided cable */}
        <path d={cable} fill="none" stroke="#0c0a07" strokeWidth={13} strokeLinecap="round" />
        <path d={cable} fill="none" stroke="#5a3b1c" strokeWidth={8} strokeLinecap="round" />
        <path d={cable} fill="none" stroke="#c98a2e" strokeWidth={8} strokeDasharray="3 5" strokeLinecap="round" opacity={0.6} />
        {/* bell jar stand */}
        <path d="M400 205 H520 L510 186 H410 Z" fill="url(#brass)" stroke="#0c0a07" strokeWidth={3.5} />
        <path d="M418 186 V70 C418 22 502 22 502 70 V186" fill="#140f09" fillOpacity={0.35} stroke="#0c0a07" strokeWidth={3.5} />
        <path d="M430 150 V76 C430 50 446 38 462 36" stroke="#fff6dc" strokeOpacity={0.4} strokeWidth={4} fill="none" strokeLinecap="round" />
        <rect x={452} y={14} width={16} height={12} rx={3} fill="url(#brass)" stroke="#0c0a07" strokeWidth={3} />
        {/* gauge on jar base */}
        <circle cx={460} cy={196} r={0} />
      </g>

      {/* lamps glow (clean, un-inked) */}
      {Array.from({ length: 9 }, (_, k) => (
        <circle key={k} cx={44 + k * 20} cy={132} r={4} fill={beam} opacity={0.15}>
          <animate attributeName="opacity" values="0.15;0.95;0.15" dur="3.6s" begin={`${k * 0.4}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {/* photons leaving the rotors */}
      {[70, 118, 166].map((x, i) => (
        <circle key={x} cx={x} cy={48} r={3} fill="url(#photon)" filter="url(#glow)">
          <animate attributeName="cy" values="52;30;52" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;0" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
        </circle>
      ))}
      {/* photon riding the cable */}
      {[0, 1.3, 2.6].map((b) => (
        <circle key={b} r={5} fill="url(#photon)" filter="url(#glow)">
          <animateMotion dur="3.9s" begin={`${b}s`} repeatCount="indefinite" path={cable} />
        </circle>
      ))}
      {/* qubit in the jar: Bloch sphere */}
      <g transform="translate(460 112)">
        <circle r={46} fill={beam} opacity={0.12} filter="url(#glow-soft)" />
        <circle r={34} fill="none" stroke="#e9dcc0" strokeOpacity={0.55} strokeWidth={1.2} />
        <ellipse rx={34} ry={10} fill="none" stroke="#e9dcc0" strokeOpacity={0.35} strokeDasharray="3 3" />
        <ellipse rx={10} ry={34} fill="none" stroke="#e9dcc0" strokeOpacity={0.2} strokeDasharray="3 3">
          <animate attributeName="rx" values="10;34;10" dur="7s" repeatCount="indefinite" />
        </ellipse>
        <line x1={0} y1={0} x2={18} y2={-26} stroke={beam} strokeWidth={2.5} filter="url(#glow)">
          <animateTransform attributeName="transform" type="rotate" values="0;40;-20;0" dur="6s" repeatCount="indefinite" />
        </line>
        <circle r={4} fill="url(#photon)" filter="url(#glow)" />
        <text x={0} y={-40} textAnchor="middle" fill="#e9dcc0" fillOpacity={0.6} fontFamily="DM Serif Display" fontSize={11}>|0⟩</text>
        <text x={0} y={50} textAnchor="middle" fill="#e9dcc0" fillOpacity={0.6} fontFamily="DM Serif Display" fontSize={11}>|1⟩</text>
      </g>
    </svg>
  );
}
