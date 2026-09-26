// Small motion toolkit shared by the landing page and the console: scroll reveals, split-text
// headlines, count-up numbers, 3-D tilt cards and magnetic buttons. All respect reduced motion.
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring, useTransform, type Variants } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Fades + lifts its children in the first time they scroll into view. */
export function Reveal({ children, delay = 0, y = 28, className, as = "div", once = true }: {
  children: ReactNode; delay?: number; y?: number; className?: string; as?: "div" | "section" | "li" | "span"; once?: boolean;
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag className={className} initial={reduce ? false : { opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once, amount: 0.2 }}
      transition={{ duration: 0.9, delay, ease: EASE }}>
      {children}
    </Tag>
  );
}

/** Staggered container: children using `revealItem` variants animate one after another. */
export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } };
export const revealItem: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.8, ease: EASE } },
};

/** Headline whose words rise out of a mask one by one. */
export function SplitText({ text, className, delay = 0, wordClassName }: { text: string; className?: string; delay?: number; wordClassName?: string }) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.12em] align-bottom" aria-hidden>
          <motion.span className={cn("inline-block", wordClassName)} initial={reduce ? false : { y: "110%", rotate: 4 }}
            whileInView={{ y: "0%", rotate: 0 }} viewport={{ once: true }} transition={{ duration: 1, delay: delay + i * 0.06, ease: EASE }}>
            {w}{i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Animates a number from its previous value (or 0) whenever it changes. */
export function CountUp({ value, format = (v: number) => Math.round(v).toLocaleString(), duration = 1.2, className }: {
  value: number; format?: (v: number) => string; duration?: number; className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);
  const inView = useInView(ref, { once: true });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const controls = animate(prev.current, value, {
      duration, ease: EASE, onUpdate: (v) => { node.textContent = format(v); },
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, inView, duration, format]);
  return <span ref={ref} className={className}>{format(prev.current)}</span>;
}

/** A card that tilts toward the pointer in 3-D, with a moving highlight. */
export function TiltCard({ children, className, max = 8, style, glare = true }: { children: ReactNode; className?: string; max?: number; style?: CSSProperties; glare?: boolean }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const rx = useSpring(useTransform(y, [0, 1], [max, -max]), { stiffness: 180, damping: 18 });
  const ry = useSpring(useTransform(x, [0, 1], [-max, max]), { stiffness: 180, damping: 18 });
  const glareBg = useTransform([x, y], ([a, b]) =>
    `radial-gradient(420px circle at ${(a as number) * 100}% ${(b as number) * 100}%, rgb(var(--brand) / .10), transparent 45%)`);
  const onMove = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    x.set((e.clientX - r.left) / r.width);
    y.set((e.clientY - r.top) / r.height);
  };
  const reset = () => { x.set(0.5); y.set(0.5); };
  return (
    <div style={{ perspective: 1000 }} className="min-w-0">
      <motion.div ref={ref} onPointerMove={reduce ? undefined : onMove} onPointerLeave={reset}
        style={{ rotateX: reduce ? 0 : rx, rotateY: reduce ? 0 : ry, transformStyle: "preserve-3d", ...style }} className={cn("relative", className)}>
        {children}
        {glare && !reduce && (
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 [div:hover>&]:opacity-100"
            style={{ background: glareBg }} />
        )}
      </motion.div>
    </div>
  );
}

/** Element that leans toward the pointer while hovered. */
export function Magnetic({ children, strength = 0.25, className }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 220, damping: 15 });
  const y = useSpring(0, { stiffness: 220, damping: 15 });
  return (
    <motion.div ref={ref} className={cn("inline-block", className)} style={{ x, y }}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength);
      }}
      onPointerLeave={() => { x.set(0); y.set(0); }}>
      {children}
    </motion.div>
  );
}

/** Mounts children only once scrolled near the viewport (keeps WebGL scenes off until needed). */
export function WhenVisible({ children, className, minHeight = 200, margin = "200px" }: { children: ReactNode; className?: string; minHeight?: number; margin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setOn(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  return <div ref={ref} className={className} style={{ minHeight }}>{on ? children : null}</div>;
}
