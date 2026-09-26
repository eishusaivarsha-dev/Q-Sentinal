// Shared React-Three-Fiber plumbing: a canvas that sleeps when off-screen, the theme palette as
// THREE colours, and a DOM label helper.
import { Html } from "@react-three/drei";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { themeHex, useUi } from "@/state/ui";

export interface Palette {
  brand: string; brand2: string; violet: string; ok: string; warn: string; bad: string; ink: string; ink3: string; line: string; bg: string; surface: string;
  dark: boolean;
}

/** Theme tokens as hex strings; recomputed when the theme flips. */
export function usePalette(): Palette {
  const theme = useUi((s) => s.theme);
  return useMemo(() => ({
    brand: themeHex("brand"), brand2: themeHex("brand-2"), violet: themeHex("violet"), ok: themeHex("ok"), warn: themeHex("warn"),
    bad: themeHex("bad"), ink: themeHex("ink"), ink3: themeHex("ink-3"), line: themeHex("line-2"), bg: themeHex("bg"), surface: themeHex("surface"),
    dark: theme === "dark",
  }), [theme]);
}

/**
 * ResizeObserver that also measures once right after observe(). Browsers only deliver resize
 * notifications during a rendering step, so a canvas mounted in a background tab (or a hidden
 * pane) would otherwise stay at 0x0 until the page is shown again.
 */
class EagerResizeObserver {
  private ro: ResizeObserver;
  constructor(private cb: ResizeObserverCallback) {
    this.ro = new ResizeObserver(cb);
  }
  observe(el: Element, opts?: ResizeObserverOptions) {
    this.ro.observe(el, opts);
    setTimeout(() => this.cb([], this.ro), 0);
  }
  unobserve(el: Element) {
    this.ro.unobserve(el);
  }
  disconnect() {
    this.ro.disconnect();
  }
}

/** A <Canvas> that only renders frames while visible and the tab is active. */
export function SceneCanvas({ children, className, camera, style, ...rest }: CanvasProps & { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("relative h-full w-full", className)} style={style}>
      <Canvas dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} frameloop={visible ? "always" : "never"} resize={{ polyfill: EagerResizeObserver as unknown as typeof ResizeObserver }}
        camera={camera ?? { position: [0, 0, 6], fov: 45 }} {...rest}>
        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>
    </div>
  );
}

export function Label({ children, position, className, tone }: { children: ReactNode; position: [number, number, number]; className?: string; tone?: string }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div className={cn("whitespace-nowrap rounded-full border border-line bg-surface/85 px-2.5 py-0.5 font-mono text-[12px] font-semibold text-ink shadow-card backdrop-blur", className)}
        style={tone ? { color: tone, borderColor: tone + "55" } : undefined}>
        {children}
      </div>
    </Html>
  );
}
