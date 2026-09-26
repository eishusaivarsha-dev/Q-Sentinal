// BorderGlow - ported from React Bits (reactbits.dev), TypeScript. A card whose edge lights up in a
// mesh gradient where the pointer approaches it. Styles live in index.css (.border-glow-card).
import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const POSITIONS = ["80% 55%", "69% 34%", "8% 6%", "41% 38%", "86% 85%", "82% 18%", "51% 4%"];
const KEYS = ["--gradient-one", "--gradient-two", "--gradient-three", "--gradient-four", "--gradient-five", "--gradient-six", "--gradient-seven"];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function glowVars(hsl: string, intensity: number) {
  const m = hsl.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  const [h, s, l] = m ? [m[1], m[2], m[3]] : ["230", "90", "65"];
  const base = `${h}deg ${s}% ${l}%`;
  const out: Record<string, string> = {};
  [100, 60, 50, 40, 30, 20, 10].forEach((o, i) => {
    out[`--glow-color${i ? `-${o}` : ""}`] = `hsl(${base} / ${Math.min(o * intensity, 100)}%)`;
  });
  return out;
}

function gradientVars(colors: string[]) {
  const out: Record<string, string> = {};
  KEYS.forEach((k, i) => {
    out[k] = `radial-gradient(at ${POSITIONS[i]}, ${colors[Math.min(COLOR_MAP[i], colors.length - 1)]} 0px, transparent 50%)`;
  });
  out["--gradient-base"] = `linear-gradient(${colors[0]} 0 100%)`;
  return out;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeIn = (x: number) => x * x * x;
function animateValue(o: { start?: number; end?: number; duration?: number; delay?: number; ease?: (x: number) => number; onUpdate: (v: number) => void; onEnd?: () => void }) {
  const { start = 0, end = 100, duration = 1000, delay = 0, ease = easeOut, onUpdate, onEnd } = o;
  const t0 = performance.now() + delay;
  const tick = () => {
    const t = Math.min((performance.now() - t0) / duration, 1);
    onUpdate(start + (end - start) * ease(Math.max(0, t)));
    if (t < 1) requestAnimationFrame(tick);
    else onEnd?.();
  };
  setTimeout(() => requestAnimationFrame(tick), delay);
}

export interface BorderGlowProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
  style?: CSSProperties;
}

export default function BorderGlow({
  children, className, innerClassName, edgeSensitivity = 30, glowColor = "230 90 66", borderRadius = 20, glowRadius = 36,
  glowIntensity = 1, coneSpread = 25, animated = false, colors = ["#3b5bff", "#00a4ce", "#7c5cff"], fillOpacity = 0.35, style,
}: BorderGlowProps) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.PointerEvent) => {
    const card = ref.current;
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const cx = r.width / 2;
    const cy = r.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    const kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
    const ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
    const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    card.style.setProperty("--edge-proximity", (edge * 100).toFixed(3));
    card.style.setProperty("--cursor-angle", `${deg.toFixed(3)}deg`);
  }, []);

  useEffect(() => {
    const card = ref.current;
    if (!animated || !card) return;
    const a0 = 110;
    const a1 = 465;
    card.classList.add("sweep-active");
    card.style.setProperty("--cursor-angle", `${a0}deg`);
    animateValue({ duration: 500, onUpdate: (v) => card.style.setProperty("--edge-proximity", String(v)) });
    animateValue({ ease: easeIn, duration: 1500, end: 50, onUpdate: (v) => card.style.setProperty("--cursor-angle", `${(a1 - a0) * (v / 100) + a0}deg`) });
    animateValue({ delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: (v) => card.style.setProperty("--cursor-angle", `${(a1 - a0) * (v / 100) + a0}deg`) });
    animateValue({ ease: easeIn, delay: 2500, duration: 1500, start: 100, end: 0, onUpdate: (v) => card.style.setProperty("--edge-proximity", String(v)), onEnd: () => card.classList.remove("sweep-active") });
  }, [animated]);

  return (
    <div ref={ref} onPointerMove={onMove} className={cn("border-glow-card", className)}
      style={{
        "--edge-sensitivity": edgeSensitivity, "--border-radius": `${borderRadius}px`, "--glow-padding": `${glowRadius}px`,
        "--cone-spread": coneSpread, "--fill-opacity": fillOpacity, ...glowVars(glowColor, glowIntensity), ...gradientVars(colors), ...style,
      } as CSSProperties}>
      <span className="edge-light" />
      <div className={cn("border-glow-inner", innerClassName)}>{children}</div>
    </div>
  );
}
