import { AnimatePresence, motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { useFraudQueue, useOverview } from "@/api/hooks";
import { cn } from "@/lib/cn";
import { useUi } from "@/state/ui";
import { Logo } from "./Logo";
import { CONSOLE, NAV, to } from "./nav";

function NavList({ onPick }: { onPick?: () => void }) {
  const ov = useOverview();
  const critical = ov.data?.alerts.critical ?? 0;
  const fraudOpen = useFraudQueue(25, false).data?.open ?? 0;
  return (
    <nav className="space-y-6">
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="mb-2 px-3 font-mono text-[12px] font-medium uppercase tracking-[.18em] text-ink-3">{g.group}</div>
          <ul className="space-y-1">
            {g.items.map((it) => (
              <li key={it.path}>
                <NavLink to={to(it.path)} end={it.path === ""} onClick={onPick}
                  className={({ isActive }) => cn("group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors",
                    isActive ? "text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink")}>
                  {({ isActive }) => (
                    <>
                      {isActive && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-2xl border border-brand/25 bg-brand/10 shadow-[0_8px_24px_-16px_rgb(var(--brand))]" transition={{ type: "spring", stiffness: 420, damping: 36 }} />}
                      <it.icon size={19} className={cn("relative shrink-0", isActive ? "text-brand" : "text-ink-3 group-hover:text-brand")} />
                      <span className="relative min-w-0">
                        <span className="block truncate text-[15px] font-semibold leading-tight">{it.label}</span>
                        <span className="block truncate text-[12.5px] text-ink-3">{it.hint}</span>
                      </span>
                      {it.path === "" && critical > 0 && <span className="relative ml-auto rounded-full bg-bad px-2 py-0.5 font-mono text-[11px] font-bold text-white">{critical}</span>}
                      {it.path === "fraud" && fraudOpen > 0 && <span className="relative ml-auto rounded-full bg-warn px-2 py-0.5 font-mono text-[11px] font-bold text-white" title="cases awaiting your decision">{fraudOpen}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  const menu = useUi((s) => s.menu);
  const setMenu = useUi((s) => s.setMenu);
  return (
    <>
      <aside className="no-print sticky top-0 hidden h-screen w-[280px] shrink-0 flex-col border-r border-line/80 bg-surface/60 px-4 py-5 backdrop-blur-xl lg:flex">
        <NavLink to={CONSOLE} className="mb-7 px-2"><Logo /></NavLink>
        <div className="-mx-2 flex-1 overflow-y-auto px-2 no-scrollbar" data-lenis-prevent><NavList /></div>
        <div className="mt-4 rounded-2xl border border-ok/25 bg-ok/8 p-3 text-[13px] leading-snug text-ink-2">
          <span className="font-bold text-ok">Physics decides.</span> Six closed-form detectors issue every verdict; the AI only advises.
        </div>
      </aside>
      <AnimatePresence>
        {menu && (
          <>
            <motion.div className="fixed inset-0 z-[90] bg-ink/40 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenu(false)} />
            <motion.aside initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed inset-y-0 left-0 z-[95] w-[290px] overflow-y-auto border-r border-line bg-surface px-4 py-5 lg:hidden" data-lenis-prevent>
              <div className="mb-6 px-2"><Logo /></div>
              <NavList onPick={() => setMenu(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
