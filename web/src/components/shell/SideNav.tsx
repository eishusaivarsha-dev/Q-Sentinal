import { NavLink } from "react-router-dom";
import { useOverview } from "@/api/hooks";
import { useUi } from "@/state/ui";

export const NAV = [
  { to: "/", code: "01", label: "Mission Control", sub: "Live watch floor" },
  { to: "/journey", code: "02", label: "Signature Journey", sub: "One signature, six layers" },
  { to: "/attacks", code: "03", label: "Attack Lab", sub: "Red-team simulator" },
  { to: "/verdicts", code: "04", label: "Verdict Inspector", sub: "Proof certificates" },
  { to: "/channels", code: "05", label: "Channel Observatory", sub: "Ellipsoid & fingerprint" },
  { to: "/ledger", code: "06", label: "Ledger Explorer", sub: "Chain, anchors, audit" },
  { to: "/transferability", code: "07", label: "Transferability", sub: "Repudiation arena" },
  { to: "/bounds", code: "08", label: "Security Bounds", sub: "How safe are we?" },
  { to: "/ops", code: "09", label: "Ops Plane", sub: "Advisory only" },
  { to: "/settings", code: "10", label: "Settings", sub: "Access & replay" },
];

/** Filing-cabinet index: each route is a drawer tab. */
export function SideNav() {
  const open = useUi((s) => s.menu);
  const setMenu = useUi((s) => s.setMenu);
  const critical = useOverview().data?.alerts.critical ?? 0;
  const close = () => setMenu(false);
  return (
    <>
      <div className={`no-print fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={close} />
      <nav
        className={`no-print fixed bottom-0 left-0 top-14 z-50 w-[248px] overflow-y-auto border-r hair bg-ink/95 px-3 py-5 transition-transform lg:sticky lg:z-10 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 lg:bg-ink/40 ${open ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Primary"
      >
        <div className="label mb-3 px-2">Index of directives</div>
        <ul className="space-y-1">
          {NAV.map((n) => (
            <li key={n.to}>
              <NavLink to={n.to} end={n.to === "/"} onClick={close}
                className={({ isActive }) => `group relative flex items-center gap-3 rounded-[6px] border px-2.5 py-2 transition ${isActive ? "border-amber/50 bg-amber/[.08]" : "border-transparent hover:border-amber/20 hover:bg-white/[.02]"}`}>
                {({ isActive }) => (
                  <>
                    <span className={`data flex h-7 w-8 items-center justify-center rounded-[3px] text-[11px] ${isActive ? "bg-amber text-ink" : "bg-ink-700 text-paper-faint group-hover:text-amber"}`}
                      style={{ boxShadow: "inset 0 -2px 0 rgba(0,0,0,.35)" }}>{n.code}</span>
                    <span className="min-w-0">
                      <span className={`block truncate font-label text-[12px] uppercase tracking-[.14em] ${isActive ? "text-amber" : "text-paper-dim group-hover:text-paper"}`}>{n.label}</span>
                      <span className="block truncate text-[10.5px] text-paper-mute">{n.sub}</span>
                    </span>
                    {n.to === "/" && critical > 0 && <span className="ml-auto rounded-full bg-reject px-1.5 font-mono text-[10px] text-ink" title="critical alerts">{critical}</span>}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="rule my-5" />
        <div className="px-2 font-type text-[11px] leading-relaxed text-paper-mute">
          Decisions on this console are issued by six closed-form physical detectors. The console only observes. Every verdict is sealed to the ledger.
        </div>
      </nav>
    </>
  );
}
