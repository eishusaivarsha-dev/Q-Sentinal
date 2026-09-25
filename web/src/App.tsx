import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import MissionControl from "./pages/MissionControl";

// Pages load on first visit, so the heavy 3-D / chart code stays out of the first download.
const Journey = lazy(() => import("./pages/Journey"));
const AttackLab = lazy(() => import("./pages/AttackLab"));
const VerdictInspector = lazy(() => import("./pages/VerdictInspector"));
const Channels = lazy(() => import("./pages/Channels"));
const LedgerExplorer = lazy(() => import("./pages/LedgerExplorer"));
const Transferability = lazy(() => import("./pages/Transferability"));
const Bounds = lazy(() => import("./pages/Bounds"));
const OpsPlane = lazy(() => import("./pages/OpsPlane"));
const Settings = lazy(() => import("./pages/Settings"));

const page = (el: React.ReactNode) => <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>{el}</Suspense>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MissionControl />} />
        <Route path="journey" element={page(<Journey />)} />
        <Route path="journey/:idx" element={page(<Journey />)} />
        <Route path="attacks" element={page(<AttackLab />)} />
        <Route path="verdicts" element={page(<VerdictInspector />)} />
        <Route path="verdicts/:idx" element={page(<VerdictInspector />)} />
        <Route path="channels" element={page(<Channels />)} />
        <Route path="ledger" element={page(<LedgerExplorer />)} />
        <Route path="transferability" element={page(<Transferability />)} />
        <Route path="bounds" element={page(<Bounds />)} />
        <Route path="ops" element={page(<OpsPlane />)} />
        <Route path="settings" element={page(<Settings />)} />
        <Route path="*" element={<MissionControl />} />
      </Route>
    </Routes>
  );
}
