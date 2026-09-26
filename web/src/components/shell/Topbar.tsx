import { Circle, Clapperboard, Menu, Moon, Sparkles, Square, Sun } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useHealth } from "@/api/hooks";
import { cn } from "@/lib/cn";
import { downloadJson, useSession } from "@/state/session";
import { useTelemetry } from "@/state/telemetry";
import { useUi } from "@/state/ui";
import { Magnetic } from "@/fx/motion";
import { NAV, to } from "./nav";

function LiveStatus() {
  const status = useTelemetry((s) => s.status);
  const health = useHealth();
  const map = {
    live: { text: "Live", cls: "text-ok", dot: "bg-ok" },
    connecting: { text: "Connecting", cls: "text-warn", dot: "bg-warn" },
    down: { text: "Backend offline", cls: "text-bad", dot: "bg-bad" },
    replay: { text: "Replay", cls: "text-brand-2", dot: "bg-brand-2" },
  }[status];
  return (
    <div className="hidden items-center gap-3 rounded-full border border-line bg-surface/80 px-4 py-2 text-[14px] shadow-card md:flex">
      <span className="relative flex h-2.5 w-2.5">
        {status === "live" && <span className={cn("absolute inline-flex h-full w-full animate-pulse-ring rounded-full", map.dot)} />}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", map.dot)} />
      </span>
      <span className={cn("font-semibold", map.cls)}>{map.text}</span>
      {health.data && (
        <span className="data hidden text-[13px] text-ink-3 xl:inline">
          {health.data.backend} · {health.data.profile} · ML-DSA {health.data.pqc}
        </span>
      )}
    </div>
  );
}

function Recorder() {
  const { recording, start, stop, replay } = useSession();
  if (replay) return null;
  return (
    <button className={cn("btn-icon", recording && "!border-bad/50 !text-bad")} title={recording ? "Stop and save the recording" : "Record this session for offline replay"}
      onClick={() => (recording ? downloadJson(`qsentinel-session-${Date.now()}.json`, stop()) : start())}>
      {recording ? <Square size={16} fill="currentColor" /> : <Circle size={16} />}
    </button>
  );
}

export default function Topbar() {
  const { pathname } = useLocation();
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const openCopilot = useUi((s) => s.openCopilot);
  const openPresenter = useUi((s) => s.openPresenter);
  const setMenu = useUi((s) => s.setMenu);
  const current = NAV.flatMap((g) => g.items).find((it) => (it.path ? pathname.startsWith(to(it.path)) : pathname === to()));
  return (
    <header className="topbar no-print sticky top-0 z-40 border-b border-line/70 bg-bg/70 backdrop-blur-xl">
      <div className="flex h-[72px] items-center gap-3 px-4 md:px-8">
        <button className="btn-icon lg:hidden" onClick={() => setMenu(true)} aria-label="Open navigation"><Menu size={18} /></button>
        <div className="min-w-0">
          <div className="truncate text-[17px] font-bold text-ink">{current?.label ?? "Console"}</div>
          <div className="truncate text-[13px] text-ink-3">{current?.hint}</div>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <LiveStatus />
          <Magnetic>
            <button className="btn-primary btn-sm !py-2" onClick={() => openCopilot()}><Sparkles size={16} /> Ask Sentinel</button>
          </Magnetic>
          <button className="btn-icon hidden sm:inline-flex" title="Presenter mode (7-step demo)" onClick={openPresenter}><Clapperboard size={17} /></button>
          <Recorder />
          <button className="btn-icon" title={theme === "dark" ? "Light theme" : "Dark theme"} onClick={toggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </div>
    </header>
  );
}
