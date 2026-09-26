import { lazy, Suspense } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { InkDefs } from "@/components/art/InkDefs";
import { Backdrop } from "@/components/art/Backdrop";
import { ErrorBoundary } from "@/components/shell/ErrorBoundary";
import { Empty } from "@/components/shell/primitives";
import { SideNav } from "@/components/shell/SideNav";
import { Toasts } from "@/components/shell/Toasts";
import { TopBar } from "@/components/shell/TopBar";
import PresenterMode from "@/demo/PresenterMode";
import MissionControl from "@/pages/MissionControl";
import { useTelemetryConnection } from "@/state/telemetry";

// Pages load on first visit, so the heavy 3-D / chart code stays out of the first download.
const Journey = lazy(() => import("@/pages/Journey"));
const AttackLab = lazy(() => import("@/pages/AttackLab"));
const VerdictInspector = lazy(() => import("@/pages/VerdictInspector"));
const ChannelObservatory = lazy(() => import("@/pages/ChannelObservatory"));
const LedgerExplorer = lazy(() => import("@/pages/LedgerExplorer"));
const Transferability = lazy(() => import("@/pages/Transferability"));
const Bounds = lazy(() => import("@/pages/Bounds"));
const OpsPlane = lazy(() => import("@/pages/OpsPlane"));
const Settings = lazy(() => import("@/pages/Settings"));
const Report = lazy(() => import("@/pages/Report"));

function Layout() {
  useTelemetryConnection();
  const loc = useLocation();
  return (
    <div className="grain relative min-h-screen">
      <InkDefs />
      <Backdrop />
      <div className="relative z-10">
        <TopBar />
        <div className="flex">
          <SideNav />
          <main className="min-w-0 flex-1 px-4 pb-40 pt-6 md:px-8 md:pt-8">
            <ErrorBoundary key={loc.pathname}>
              <Suspense fallback={<Empty>Unlocking the drawer…</Empty>}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
      <Toasts />
      <PresenterMode />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MissionControl />} />
        <Route path="journey" element={<Journey />} />
        <Route path="journey/:idx" element={<Journey />} />
        <Route path="attacks" element={<AttackLab />} />
        <Route path="verdicts" element={<VerdictInspector />} />
        <Route path="verdicts/:idx" element={<VerdictInspector />} />
        <Route path="channels" element={<ChannelObservatory />} />
        <Route path="ledger" element={<LedgerExplorer />} />
        <Route path="transferability" element={<Transferability />} />
        <Route path="bounds" element={<Bounds />} />
        <Route path="ops" element={<OpsPlane />} />
        <Route path="settings" element={<Settings />} />
        <Route path="report" element={<Report />} />
        <Route path="*" element={<Empty>This drawer is empty. The file you seek was never filed.</Empty>} />
      </Route>
    </Routes>
  );
}
