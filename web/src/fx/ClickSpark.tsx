// ClickSpark - ported from React Bits (reactbits.dev), TypeScript. Every click throws a ring of
// sparks from the pointer. Used once around the whole app; spark colour follows the theme.
import { useEffect, useRef, type ReactNode } from "react";
import { themeColor } from "@/state/ui";

interface Spark { x: number; y: number; angle: number; start: number }

export default function ClickSpark({ children, sparkSize = 10, sparkRadius = 22, sparkCount = 8, duration = 450 }: {
  children: ReactNode; sparkSize?: number; sparkRadius?: number; sparkCount?: number; duration?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const sparks = useRef<Spark[]>([]);
  const raf = useRef(0);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio);
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const onClick = (e: MouseEvent) => {
      const now = performance.now();
      for (let i = 0; i < sparkCount; i++) sparks.current.push({ x: e.clientX, y: e.clientY, angle: (2 * Math.PI * i) / sparkCount, start: now });
      if (!raf.current) raf.current = requestAnimationFrame(draw);
    };
    const draw = (t: number) => {
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, c.width, c.height);
      const color = themeColor("brand");
      sparks.current = sparks.current.filter((s) => {
        const p = (t - s.start) / duration;
        if (p >= 1) return false;
        const eased = p * (2 - p);
        const d = eased * sparkRadius;
        const len = sparkSize * (1 - eased);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 1 - p * 0.6;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x + d * Math.cos(s.angle), s.y + d * Math.sin(s.angle));
        ctx.lineTo(s.x + (d + len) * Math.cos(s.angle), s.y + (d + len) * Math.sin(s.angle));
        ctx.stroke();
        return true;
      });
      raf.current = sparks.current.length ? requestAnimationFrame(draw) : 0;
    };
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf.current);
    };
  }, [sparkSize, sparkRadius, sparkCount, duration]);

  return (
    <>
      {children}
      <canvas ref={canvas} aria-hidden className="pointer-events-none fixed inset-0 z-[200] h-screen w-screen" />
    </>
  );
}
