// Lenis smooth scrolling for the whole app, plus a tiny store other code reads the scroll position
// from (the landing page's 3-D scene is driven by it). Disabled when the user prefers reduced motion.
import Lenis from "lenis";
import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { create } from "zustand";

interface ScrollState { y: number; progress: number; velocity: number }
export const useScroll = create<ScrollState>(() => ({ y: 0, progress: 0, velocity: 0 }));

let lenis: Lenis | null = null;
export const scrollToTop = () => (lenis ? lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0));
export const scrollToEl = (el: HTMLElement | string) => (lenis ? lenis.scrollTo(el, { offset: -20, duration: 1.4 }) : undefined);

export default function SmoothScroll({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const publish = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      useScroll.setState({ y: window.scrollY, progress: max > 0 ? window.scrollY / max : 0, velocity: lenis?.velocity ?? 0 });
    };
    if (reduce) {
      window.addEventListener("scroll", publish, { passive: true });
      return () => window.removeEventListener("scroll", publish);
    }
    lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true, wheelMultiplier: 0.9 });
    lenis.on("scroll", publish);
    let raf = 0;
    const loop = (t: number) => {
      lenis?.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [pathname]);

  return <>{children}</>;
}
