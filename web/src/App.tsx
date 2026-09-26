import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import ConsoleLayout from "@/components/shell/ConsoleLayout";
import MissionControl from "@/pages/console/MissionControl";

// The landing page and every console page load on first visit, so 3-D / chart code stays out of
// the first download.
const Landing = lazy(() => import("@/pages/Landing"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Journey = lazy(() => import("@/pages/console/Journey"));
const AttackLab = lazy(() => import("@/pages/console/AttackLab"));
const Verdicts = lazy(() => import("@/pages/console/Verdicts"));
const Channels = lazy(() => import("@/pages/console/Channels"));
const TeleportLab = lazy(() => import("@/pages/console/TeleportLab"));
const Ledger = lazy(() => import("@/pages/console/Ledger"));
const Transferability = lazy(() => import("@/pages/console/Transferability"));
const Bounds = lazy(() => import("@/pages/console/Bounds"));
const FraudReview = lazy(() => import("@/pages/console/FraudReview"));
const Ops = lazy(() => import("@/pages/console/Ops"));
const Settings = lazy(() => import("@/pages/console/Settings"));
const Report = lazy(() => import("@/pages/console/Report"));

export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <Routes>
        <Route index element={<Landing />} />
        <Route path="console" element={<ConsoleLayout />}>
          <Route index element={<MissionControl />} />
          <Route path="journey" element={<Journey />} />
          <Route path="journey/:idx" element={<Journey />} />
          <Route path="attacks" element={<AttackLab />} />
          <Route path="verdicts" element={<Verdicts />} />
          <Route path="verdicts/:idx" element={<Verdicts />} />
          <Route path="channels" element={<Channels />} />
          <Route path="teleport" element={<TeleportLab />} />
          <Route path="ledger" element={<Ledger />} />
          <Route path="transferability" element={<Transferability />} />
          <Route path="bounds" element={<Bounds />} />
          <Route path="fraud" element={<FraudReview />} />
          <Route path="fraud/:idx" element={<FraudReview />} />
          <Route path="ops" element={<Ops />} />
          <Route path="settings" element={<Settings />} />
          <Route path="report" element={<Report />} />
          <Route path="*" element={<NotFound inConsole />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
