// AnimatedList - ported from React Bits (reactbits.dev), TypeScript + generic rows. Items pop in as
// they scroll into view, the hovered/selected row is highlighted, arrow keys move the selection and
// soft fades mark more content above/below.
import { motion, useInView } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

function AnimatedItem({ children, index, delay = 0.05, onMouseEnter, onClick }: {
  children: ReactNode; index: number; delay?: number; onMouseEnter: () => void; onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  return (
    <motion.div ref={ref} data-index={index} onMouseEnter={onMouseEnter} onClick={onClick}
      initial={{ scale: 0.85, opacity: 0, y: 10 }} animate={inView ? { scale: 1, opacity: 1, y: 0 } : { scale: 0.85, opacity: 0, y: 10 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }} className="cursor-pointer">
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps<T> {
  items: T[];
  render: (item: T, selected: boolean, index: number) => ReactNode;
  itemKey: (item: T, index: number) => string | number;
  onSelect?: (item: T, index: number) => void;
  className?: string;
  maxHeight?: number | string;
  keyboard?: boolean;
  gap?: number;
}

export default function AnimatedList<T>({ items, render, itemKey, onSelect, className, maxHeight = 460, keyboard = false, gap = 10 }: AnimatedListProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(-1);
  const [kbd, setKbd] = useState(false);
  const [topFade, setTopFade] = useState(0);
  const [bottomFade, setBottomFade] = useState(1);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setTopFade(Math.min(scrollTop / 50, 1));
    const rest = scrollHeight - (scrollTop + clientHeight);
    setBottomFade(scrollHeight <= clientHeight ? 0 : Math.min(rest / 50, 1));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (el) setBottomFade(el.scrollHeight <= el.clientHeight ? 0 : 1);
  }, [items.length]);

  useEffect(() => {
    if (!keyboard) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input,textarea,select")) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setKbd(true); setSelected((p) => Math.min(p + 1, items.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setKbd(true); setSelected((p) => Math.max(p - 1, 0)); }
      else if (e.key === "Enter" && selected >= 0 && selected < items.length) onSelect?.(items[selected], selected);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keyboard, items, selected, onSelect]);

  useEffect(() => {
    const el = listRef.current;
    if (!kbd || selected < 0 || !el) return;
    const item = el.querySelector<HTMLElement>(`[data-index="${selected}"]`);
    if (item) {
      const m = 40;
      if (item.offsetTop < el.scrollTop + m) el.scrollTo({ top: item.offsetTop - m, behavior: "smooth" });
      else if (item.offsetTop + item.offsetHeight > el.scrollTop + el.clientHeight - m)
        el.scrollTo({ top: item.offsetTop + item.offsetHeight - el.clientHeight + m, behavior: "smooth" });
    }
    setKbd(false);
  }, [selected, kbd]);

  return (
    <div className={cn("alist", className)}>
      <div ref={listRef} className="alist-scroll no-scrollbar pr-1" style={{ maxHeight }} onScroll={onScroll} data-lenis-prevent>
        <div className="flex flex-col" style={{ gap }}>
          {items.map((item, i) => (
            <AnimatedItem key={itemKey(item, i)} index={i} onMouseEnter={() => setSelected(i)} onClick={() => { setSelected(i); onSelect?.(item, i); }}>
              {render(item, selected === i, i)}
            </AnimatedItem>
          ))}
        </div>
      </div>
      <div className="alist-fade-top" style={{ opacity: topFade }} />
      <div className="alist-fade-bottom" style={{ opacity: bottomFade }} />
    </div>
  );
}
