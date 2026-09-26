import { useEffect, useRef } from 'react';
import { CipherWheel } from './CipherWheel';

/** Drifting photon motes — warm light, never neon blue. Paused for reduced-motion. */
function PhotonField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { w = cv.width = innerWidth * dpr; h = cv.height = innerHeight * dpr; };
    resize();
    addEventListener('resize', resize);
    const N = Math.round(Math.min(70, (innerWidth * innerHeight) / 22000));
    const ps = Array.from({ length: N }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: (0.6 + Math.random() * 1.8) * dpr,
      vx: (Math.random() - 0.5) * 0.15 * dpr, vy: (-0.08 - Math.random() * 0.25) * dpr, p: Math.random() * Math.PI * 2,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of ps) {
        p.x += p.vx + Math.sin(p.p) * 0.12 * dpr; p.y += p.vy; p.p += 0.012;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        const a = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(p.p * 2.3));
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
        g.addColorStop(0, `rgba(255,241,201,${a})`);
        g.addColorStop(0.35, `rgba(255,193,94,${a * 0.45})`);
        g.addColorStop(1, 'rgba(240,165,58,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

/** Aged blueprint of a quantum circuit — drawn onto the wall of the lab. */
function CircuitBlueprint() {
  const wires = [40, 90, 140, 190];
  return (
    <svg viewBox="0 0 560 240" className="h-auto w-[640px] max-w-none" aria-hidden>
      <g fill="none" stroke="#b7d3c6" strokeOpacity={0.5} strokeWidth={1.4} filter="url(#ink)">
        {wires.map((y, i) => (
          <g key={y}>
            <text x={6} y={y + 4} fill="#b7d3c6" fillOpacity={0.6} stroke="none" fontFamily="DM Serif Display" fontSize={14}>{['|ψ⟩', '|0⟩', '|0⟩', '|+⟩'][i]}</text>
            <line x1={40} y1={y} x2={540} y2={y} />
          </g>
        ))}
        <rect x={80} y={25} width={30} height={30} /><text x={95} y={46} textAnchor="middle" fill="#b7d3c6" stroke="none" fontFamily="Oswald" fontSize={16}>H</text>
        <circle cx={160} cy={40} r={4} fill="#b7d3c6" /><line x1={160} y1={40} x2={160} y2={98} /><circle cx={160} cy={90} r={8} /><line x1={152} y1={90} x2={168} y2={90} />
        <rect x={210} y={125} width={30} height={30} /><text x={225} y={146} textAnchor="middle" fill="#b7d3c6" stroke="none" fontFamily="Oswald" fontSize={16}>X</text>
        <circle cx={280} cy={90} r={4} fill="#b7d3c6" /><line x1={280} y1={90} x2={280} y2={198} /><circle cx={280} cy={190} r={8} /><line x1={272} y1={190} x2={288} y2={190} />
        <rect x={330} y={75} width={30} height={30} /><text x={345} y={96} textAnchor="middle" fill="#b7d3c6" stroke="none" fontFamily="Oswald" fontSize={14}>Rz</text>
        {[40, 90, 140, 190].map((y) => (
          <g key={`m${y}`} transform={`translate(470 ${y - 15})`}><rect width={36} height={30} /><path d="M6 24 A12 12 0 0 1 30 24" /><line x1={18} y1={24} x2={28} y2={9} /></g>
        ))}
        <path d="M60 220 H520" strokeDasharray="4 6" />
        <text x={60} y={236} fill="#b7d3c6" fillOpacity={0.5} stroke="none" fontFamily="Special Elite" fontSize={10}>FIG. 7 — SIGNATURE STATE PREPARATION · DWG QS-1943-B · SHEET 2 OF 9</text>
      </g>
    </svg>
  );
}

/** Thick inked cables along the floor with photon pulses running through them. */
function Cables() {
  const paths = [
    'M-20 60 C 200 10, 360 110, 620 50 S 1040 10, 1460 70',
    'M-20 90 C 260 120, 480 30, 760 90 S 1180 130, 1460 80',
  ];
  return (
    <svg viewBox="0 0 1440 140" preserveAspectRatio="none" className="h-[140px] w-full" aria-hidden>
      {paths.map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke="#0c0a07" strokeWidth={14} />
          <path d={d} fill="none" stroke={i ? '#3a2a16' : '#4a331a'} strokeWidth={9} />
          <path d={d} fill="none" stroke="#f3c877" strokeOpacity={0.12} strokeWidth={2} transform="translate(0 -2)" />
          <circle r={5} fill="url(#photon)" filter="url(#glow)">
            <animateMotion dur={`${9 + i * 4}s`} repeatCount="indefinite" path={d} />
          </circle>
        </g>
      ))}
    </svg>
  );
}

export function Backdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(1200px 600px at 70% -10%, rgba(200,80,42,.16), transparent 60%), radial-gradient(900px 500px at 10% 110%, rgba(240,165,58,.08), transparent 60%), #0c0a07' }} />
      <div className="absolute -left-24 top-24 rotate-[-4deg] opacity-[.14]"><CircuitBlueprint /></div>
      <div className="absolute -bottom-40 -right-40 opacity-[.13]"><CipherWheel size={620} quantum={1} /></div>
      <div className="absolute inset-x-0 bottom-0 opacity-40"><Cables /></div>
      <PhotonField />
      <div className="vignette" />
    </div>
  );
}
