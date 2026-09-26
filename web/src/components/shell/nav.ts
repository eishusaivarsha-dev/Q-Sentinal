import {
  Atom, Blocks, BrainCircuit, Crosshair, FileText, LayoutDashboard, Radar, Route, Scale, ScrollText, Settings2, ShieldAlert, Sigma, type LucideIcon,
} from "lucide-react";

export const CONSOLE = "/console";
export const to = (path = "") => (path ? `${CONSOLE}/${path.replace(/^\//, "")}` : CONSOLE);

export interface NavItem { path: string; label: string; hint: string; icon: LucideIcon }
export const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Operate", items: [
    { path: "", label: "Mission Control", hint: "Live network & alerts", icon: LayoutDashboard },
    { path: "attacks", label: "Attack Lab", hint: "Red-team simulator", icon: Crosshair },
    { path: "verdicts", label: "Verdicts", hint: "Proof certificates", icon: ScrollText },
  ] },
  { group: "Observe", items: [
    { path: "channels", label: "Channels", hint: "Ellipsoid & fingerprint", icon: Radar },
    { path: "teleport", label: "Teleport Lab", hint: "Exact state-vector engine", icon: Atom },
    { path: "ledger", label: "Ledger", hint: "Chain, anchors, audit", icon: Blocks },
  ] },
  { group: "Prove", items: [
    { path: "journey", label: "Signature Journey", hint: "One signature, six layers", icon: Route },
    { path: "transferability", label: "Transferability", hint: "Commit-reveal shuffle", icon: Scale },
    { path: "bounds", label: "Security Bounds", hint: "Forgery & false alarms", icon: Sigma },
    { path: "report", label: "Report", hint: "D1–D6 acceptance", icon: FileText },
  ] },
  { group: "Assist", items: [
    { path: "fraud", label: "Fraud Review", hint: "AI advises · you decide", icon: ShieldAlert },
    { path: "ops", label: "AI Ops & Copilot", hint: "Advisory only", icon: BrainCircuit },
    { path: "settings", label: "Settings", hint: "Access & replay", icon: Settings2 },
  ] },
];
