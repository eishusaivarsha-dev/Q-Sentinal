import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import PresenterMode from "@/demo/PresenterMode";
import { useTelemetryConnection } from "@/state/telemetry";
import { useUi } from "@/state/ui";
import CopilotDrawer from "../copilot/CopilotDrawer";
import { Skeleton } from "../ui";
import ErrorBoundary from "./ErrorBoundary";
import Sidebar from "./Sidebar";
import Toasts from "./Toasts";
import Topbar from "./Topbar";

const Aurora = lazy(() => import("@/fx/Aurora"));

function Backdrop() {
  const theme = useUi((s) => s.theme);
  const dark = theme === "dark";
  return (
    <div aria-hidden className="no-print pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 dot-grid" />
      <div className="absolute inset-0 bloom" />
      <div className="absolute inset-x-0 top-0 h-[560px] mask-fade-b" style={{ opacity: dark ? 0.55 : 0.32 }}>
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <Aurora key={theme} lightMode={!dark} amplitude={0.9} blend={0.6} speed={0.6}
              colorStops={dark ? ["#3b5bff", "#22d3ee", "#7c5cff"] : ["#8fa4ff", "#7fe3f5", "#b8a6ff"]} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-14 w-80" />
      <div className="grid gap-5 md:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
      <Skeleton className="h-80" />
    </div>
  );
}

export default function ConsoleLayout() {
  useTelemetryConnection();
  const loc = useLocation();
  const outlet = useOutlet();
  return (
    <div className="relative flex min-h-screen">
      <Backdrop />
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Topbar />
        <main className="mx-auto w-full max-w-[1500px] px-4 pb-40 pt-8 md:px-8 md:pt-10">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={loc.pathname} initial={{ opacity: 0, y: 18, filter: "blur(8px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(6px)" }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
              <ErrorBoundary key={loc.pathname}>
                <Suspense fallback={<PageFallback />}>{outlet}</Suspense>
              </ErrorBoundary>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <Toasts />
      <CopilotDrawer />
      <PresenterMode />
    </div>
  );
}
