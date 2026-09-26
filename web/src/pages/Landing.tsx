// Public landing page: a 3-D entangled core as the hero, a scroll-driven 3-D walk through the
// protocol, the six detectors, the "AI advises, you decide" promise, and live numbers from the API.
import { useQuery } from "@tanstack/react-query";
import { motion, useMotionValueEvent, useScroll as useFramerScroll } from "framer-motion";
import {
  ArrowRight, Atom, BadgeCheck, Blocks, BrainCircuit, Clapperboard, Fingerprint, Gavel, Github, KeyRound, Moon, Radar, Repeat, ShieldCheck, Sigma, Sun, Waves,
  type LucideIcon,
} from "lucide-react";
import { lazy, Suspense, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { DETECTOR_IDS, DETECTORS, type DetectorId } from "@/lib/attribution";
import { cn } from "@/lib/cn";
import { useUi } from "@/state/ui";
import ErrorBoundary from "@/components/shell/ErrorBoundary";
import { Logo } from "@/components/shell/Logo";
import { CONSOLE, to } from "@/components/shell/nav";
import { CountUp, Magnetic, Reveal, SplitText, TiltCard, WhenVisible } from "@/fx/motion";
import { scrollToEl } from "@/fx/SmoothScroll";

const HeroScene = lazy(() => import("@/three/HeroScene"));
const StoryScene = lazy(() => import("@/three/StoryScene"));
const RiskOrb = lazy(() => import("@/three/RiskOrb"));
const Aurora = lazy(() => import("@/fx/Aurora"));

const REPO = "https://github.com/eishusaivarsha-dev/Q-Sentinal";

const STORY = [
  { t: "Keys", h: "A one-time key, born quantum", b: "The signer prepares qubits in six possible directions. Only she knows which. The key is used once, then burned." },
  { t: "Teleport", h: "Teleported, not transmitted", b: "Each qubit crosses the network by teleportation over a shared Bell pair: a measurement, two classical bits, a Pauli fix." },
  { t: "Sign", h: "The message picks the coins", b: "A hash of the message decides which directions are revealed. Change one character and a completely different set is revealed." },
  { t: "Verify", h: "Physics checks the answer", b: "The verifier measures every coin in the revealed direction. An honest signature always matches; a forger must guess." },
  { t: "Detect", h: "Eavesdroppers leave fingerprints", b: "Six closed-form detectors run on every signature. Listening on the channel collapses entanglement and bends the error pattern." },
  { t: "Record", h: "Every verdict, chained forever", b: "The verdict is hash-chained, signed with post-quantum ML-DSA-65 and anchored under a Merkle root anyone can check." },
];

const DET_ICON: Record<DetectorId, LucideIcon> = { D1: Atom, D2: Sigma, D3: Waves, D4: Radar, D5: Repeat, D6: Fingerprint };

const LAYERS: [string, string, string][] = [
  ["L0", "Quantum substrate", "Stim stabilizer simulator, Qiskit Aer cross-check, exact state-vector engine"],
  ["L1", "QDS protocol", "Six-state keys, teleportation, Lamport-style binding, commit-reveal symmetrisation"],
  ["L2", "Trust kernel", "D1–D6 detectors, Chernoff calibration, SPRT / CUSUM, proof certificates — no AI"],
  ["L3", "Post-quantum ledger", "ML-DSA-65 signatures, ML-KEM-768 tunnel, hash chain + Merkle anchors"],
  ["L4", "Red team", "17 attack scenarios, sweeps and campaigns, all caught by their declared detector"],
  ["L5", "Advisory AI", "Incident clustering, forecasts, anomaly ranking, fraud triage and Claude copilot — humans decide"],
];

function Nav() {
  const theme = useUi((s) => s.theme);
  const toggle = useUi((s) => s.toggleTheme);
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto mt-4 flex max-w-6xl items-center gap-3 rounded-full border border-white/10 bg-[#070b1a]/60 px-4 py-2.5 text-white backdrop-blur-xl md:px-6">
        <Link to="/" className="[&_.text-ink]:!text-white [&_.text-ink-3]:!text-white/60"><Logo /></Link>
        <nav className="ml-6 hidden items-center gap-6 text-[15px] font-medium text-white/75 lg:flex">
          {[["story", "How it works"], ["detectors", "Detectors"], ["ai", "AI + you"], ["numbers", "Proof"]].map(([id, l]) => (
            <button key={id} className="transition hover:text-white" onClick={() => scrollToEl(`#${id}`)}>{l}</button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <a href={REPO} target="_blank" rel="noreferrer" className="hidden h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:text-white sm:flex" aria-label="Source on GitHub"><Github size={17} /></a>
          <button onClick={toggle} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/80 transition hover:text-white" aria-label="Toggle theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button>
          <Link to={CONSOLE} className="btn-primary btn-sm !py-2">Open console <ArrowRight size={15} /></Link>
        </div>
      </div>
    </header>
  );
}

function LiveChips() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, retry: false });
  const ov = useQuery({ queryKey: ["overview"], queryFn: api.overview, retry: false });
  if (!health.data) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="mt-8 flex flex-wrap gap-2 text-[13px]">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 font-semibold text-emerald-300">
        <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-emerald-400" /><span className="relative h-2 w-2 rounded-full bg-emerald-400" /></span>Live system
      </span>
      {ov.data && <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-white/75">{ov.data.verdicts.total} verdicts · {ov.data.ledger.entries} ledger entries</span>}
      <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-white/75">{health.data.backend} · ML-DSA {health.data.pqc}</span>
    </motion.div>
  );
}

function Hero() {
  const nav = useNavigate();
  const openPresenter = useUi((s) => s.openPresenter);
  return (
    <section className="relative flex min-h-[100svh] items-center overflow-hidden bg-[#050814] text-white">
      <ErrorBoundary fallback={<div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_40%,#1b2a6b,transparent)]" />}>
        <div className="absolute inset-0"><Suspense fallback={null}><HeroScene /></Suspense></div>
      </ErrorBoundary>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#050814_0%,rgba(5,8,20,.75)_38%,transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[rgb(var(--bg))] to-transparent" />
      <div className="relative mx-auto w-full max-w-6xl px-5 pt-28 md:px-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="font-mono text-[13px] uppercase tracking-[.2em] text-cyan-300">Smart India Hackathon 2026 · quantum digital signatures</motion.div>
        <h1 className="mt-5 max-w-3xl text-[48px] font-extrabold leading-[1.02] tracking-tight md:text-[80px]">
          <SplitText text="Signatures that" /> <br />
          <SplitText text="physics can prove." wordClassName="font-serif font-normal italic text-transparent bg-clip-text bg-[linear-gradient(100deg,#8fa4ff,#22d3ee_55%,#a78bfa)]" delay={0.25} />
        </h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.9 }} className="mt-6 max-w-xl text-[18px] leading-relaxed text-white/75">
          Q-SENTINEL verifies quantum digital signatures with six AI-free detectors and a post-quantum ledger. An advisory AI watches for fraud and explains what it sees — <b className="text-white">you make the call.</b>
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.9 }} className="mt-9 flex flex-wrap items-center gap-3">
          <Magnetic><Link to={CONSOLE} className="btn-primary !px-6 !py-3 !text-[16px]">Launch the console <ArrowRight size={18} /></Link></Magnetic>
          <Magnetic><button onClick={() => { openPresenter(); nav(CONSOLE); }} className="btn !border !border-white/20 !bg-white/5 !px-6 !py-3 !text-[16px] text-white hover:!bg-white/10"><Clapperboard size={18} />Watch the 6-minute demo</button></Magnetic>
        </motion.div>
        <LiveChips />
      </div>
      <button onClick={() => scrollToEl("#story")} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[13px] font-medium text-white/60 transition hover:text-white" aria-label="Scroll to the story">
        <motion.span className="flex flex-col items-center gap-2" animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity }}>scroll<span className="h-8 w-[1.5px] rounded-full bg-white/40" /></motion.span>
      </button>
    </section>
  );
}

function Marquee() {
  const items = ["ML-DSA-65 signed ledger", "ML-KEM-768 tunnel", "CHSH S = 2.83", "(3/4)¹²⁸ ≈ 10⁻¹⁶ forgery", "Stim + Qiskit Aer", "17 / 17 attacks caught", "Merkle-anchored proofs", "AI in trust path: NO", "Human decides fraud"];
  return (
    <div className="relative overflow-hidden border-y border-line bg-surface/60 py-4">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap pr-10 font-mono text-[14px] font-medium uppercase tracking-[.14em] text-ink-3">
        {[...items, ...items].map((t, i) => <span key={i} className="flex items-center gap-10">{t}<span className="h-1.5 w-1.5 rounded-full bg-brand" /></span>)}
      </div>
    </div>
  );
}

function Story() {
  const ref = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState(0);
  const { scrollYProgress } = useFramerScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(scrollYProgress, "change", (v) => setStage(Math.min(5, Math.max(0, v * 6 - 0.2))));
  const active = Math.min(5, Math.round(stage));
  return (
    <section id="story" ref={ref} className="relative" style={{ height: "520vh" }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 md:px-8 lg:grid-cols-[1fr_1.25fr]">
          <div>
            <div className="eyebrow">How it works · 6 steps</div>
            <h2 className="mt-3 text-[40px] font-extrabold leading-[1.05] text-ink md:text-[54px]">One signature, <span className="font-serif font-normal italic text-gradient">six layers.</span></h2>
            <ol className="mt-8 space-y-2">
              {STORY.map((s, i) => (
                <li key={s.t}>
                  <motion.div animate={{ opacity: i === active ? 1 : 0.45 }} className={cn("rounded-2xl border p-4 transition-colors", i === active ? "border-brand/35 bg-surface shadow-card" : "border-transparent")}>
                    <div className="flex items-center gap-3">
                      <span className={cn("data flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold", i === active ? "bg-brand text-white" : "bg-line text-ink-3")}>{i + 1}</span>
                      <span className="text-[17px] font-bold text-ink">{s.h}</span>
                    </div>
                    <motion.p initial={false} animate={{ height: i === active ? "auto" : 0, opacity: i === active ? 1 : 0 }} className="overflow-hidden pl-11 text-[15px] leading-relaxed text-ink-2">
                      <span className="block pt-2">{s.b}</span>
                    </motion.p>
                  </motion.div>
                </li>
              ))}
            </ol>
          </div>
          <div className="card relative h-[46vh] overflow-hidden lg:h-[70vh]">
            <div className="absolute left-5 top-5 z-10 rounded-full border border-line bg-surface/80 px-3 py-1 font-mono text-[12px] font-semibold uppercase tracking-wider text-brand backdrop-blur">{STORY[active].t}</div>
            <div className="absolute inset-0 dot-grid opacity-60" />
            <ErrorBoundary fallback={null}><Suspense fallback={null}><StoryScene stage={stage} /></Suspense></ErrorBoundary>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-line"><motion.div className="h-full" style={{ scaleX: scrollYProgress, transformOrigin: "0 50%", background: "linear-gradient(90deg, rgb(var(--brand)), rgb(var(--brand-2)))" }} /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Detectors() {
  return (
    <section id="detectors" className="mx-auto max-w-6xl px-5 py-28 md:px-8">
      <Reveal>
        <div className="eyebrow">The trust kernel</div>
        <h2 className="mt-3 max-w-3xl text-[40px] font-extrabold leading-[1.05] text-ink md:text-[54px]">Six laws. <span className="font-serif font-normal italic text-gradient">Zero guesswork.</span></h2>
        <p className="mt-4 max-w-2xl text-[17px] text-ink-2">Every verdict is a closed-form statistical rule with a proven error bound. No model to poison, no weights to drift — and CI fails the build if an ML library ever reaches this code.</p>
      </Reveal>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {DETECTOR_IDS.map((id, i) => {
          const Icon = DET_ICON[id];
          return (
            <Reveal key={id} delay={i * 0.06}>
              <TiltCard className="h-full">
                <div className="card card-hover h-full p-6">
                  <div className="flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon size={22} /></span>
                    <span className="data text-[28px] font-bold text-line-2">{id}</span>
                  </div>
                  <h3 className="mt-5 text-[20px] font-bold text-ink">{DETECTORS[id].name}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{DETECTORS[id].law}</p>
                </div>
              </TiltCard>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function AiSection() {
  const steps: [LucideIcon, string, string][] = [
    [ShieldCheck, "Physics decides the verdict", "ACCEPT or REJECT comes only from the six detectors."],
    [BrainCircuit, "The AI hunts for fraud", "It combines alerts, ledger disputes, anomaly scores and signer history into a risk score — and explains every point of it."],
    [Gavel, "You make the call", "Confirm, escalate, monitor or dismiss. Your decision is signed onto the ledger next to the AI's advice."],
  ];
  return (
    <section id="ai" className="relative overflow-hidden border-y border-line bg-surface/50 py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 md:px-8 lg:grid-cols-2">
        <Reveal>
          <div className="eyebrow">Human in the loop</div>
          <h2 className="mt-3 text-[40px] font-extrabold leading-[1.05] text-ink md:text-[54px]">The AI advises. <span className="font-serif font-normal italic text-gradient">You decide.</span></h2>
          <p className="mt-4 text-[17px] text-ink-2">Machine learning is kept where it helps and cannot hurt: outside the trust path, reading telemetry through a one-way valve.</p>
          <ol className="mt-8 space-y-4">
            {steps.map(([Icon, t, b]) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon size={20} /></span>
                <span><span className="block text-[17px] font-bold text-ink">{t}</span><span className="block text-[15px] text-ink-2">{b}</span></span>
              </li>
            ))}
          </ol>
          <Link to={to("fraud")} className="btn-primary mt-9">Open the fraud review queue <ArrowRight size={16} /></Link>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="card overflow-hidden">
            <div className="relative h-[280px] border-b border-line bg-surface-2/60">
              <WhenVisible minHeight={280}><ErrorBoundary fallback={null}><Suspense fallback={null}><RiskOrb risk={92} reasons={3} decided={false} height={280} /></Suspense></ErrorBoundary></WhenVisible>
              <span className="absolute left-4 top-4 rounded-full border border-bad/30 bg-bad/10 px-3 py-1 text-[13px] font-bold text-bad">risk 92 / 100 · critical</span>
            </div>
            <div className="p-6">
              <div className="data text-[13px] text-ink-3">case QS-00042 · alice → bob</div>
              <div className="mt-1 text-[24px] font-extrabold text-ink">Stolen keystore</div>
              <p className="mt-2 text-[15px] text-ink-2">A decoy (honeypot) key was used to sign. Only someone holding a copy of the key store could do that.</p>
              <div className="mt-5 grid grid-cols-2 gap-2">
                {[["Confirm fraud", "border-bad/40 bg-bad/8 text-bad", true], ["Escalate", "border-warn/40 text-warn", false], ["Monitor", "border-line text-ink-2", false], ["Dismiss", "border-line text-ink-2", false]].map(([l, c, ai]) => (
                  <div key={l as string} className={cn("flex items-center justify-between rounded-xl border px-3 py-2 text-[14px] font-semibold", c as string)}>
                    {l}{ai && <span className="rounded-full bg-violet/12 px-2 py-0.5 text-[11px] text-violet">AI suggests</span>}
                  </div>
                ))}
              </div>
              <p className="mt-4 flex items-center gap-2 text-[13px] text-ink-3"><BadgeCheck size={15} className="text-ok" />Your choice is ML-DSA signed onto the ledger.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Numbers() {
  const stats: [number, (v: number) => string, string, string][] = [
    [65536, (v) => Math.round(v).toLocaleString(), "honest rounds, 0 mismatches", "every genuine signature verifies"],
    [17, (v) => `${Math.round(v)}/17`, "attack scenarios caught", "forgery, eavesdropping, replay, MITM, repudiation…"],
    [116, (v) => `${Math.round(v)}/s`, "full-size signatures per second", "above the 100/s target, ledger included"],
    [16, (v) => `10⁻${Math.round(v)}`, "forger's odds per block", "(3/4)¹²⁸ — closed form, not a guess"],
    [2.83, (v) => v.toFixed(2), "CHSH score on a clean link", "classical physics tops out at 2"],
    [0.9, (v) => `${v.toFixed(1)}%`, "bound vs simulator gap", "the deliverable allows 10%"],
  ];
  return (
    <section id="numbers" className="mx-auto max-w-6xl px-5 py-28 md:px-8">
      <Reveal>
        <div className="eyebrow">Verified, not claimed</div>
        <h2 className="mt-3 text-[40px] font-extrabold leading-[1.05] text-ink md:text-[54px]">The numbers <span className="font-serif font-normal italic text-gradient">hold.</span></h2>
      </Reveal>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map(([v, f, l, s], i) => (
          <Reveal key={l} delay={i * 0.05}>
            <div className="card card-hover p-6">
              <div className="data text-[44px] font-bold leading-none text-gradient"><CountUp value={v} format={f} /></div>
              <div className="mt-3 text-[16px] font-bold text-ink">{l}</div>
              <div className="text-[14px] text-ink-3">{s}</div>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-20">
        <div className="eyebrow">Architecture</div>
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-surface">
          {LAYERS.map(([l, t, d]) => (
            <div key={l} className="group grid grid-cols-[64px_1fr] items-center gap-4 px-5 py-4 transition-colors hover:bg-brand/5 md:grid-cols-[80px_260px_1fr]">
              <span className="data text-[18px] font-bold text-brand">{l}</span>
              <span className="text-[16px] font-bold text-ink">{t}</span>
              <span className="col-span-2 text-[14.5px] text-ink-3 md:col-span-1">{d}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[#050814] py-32 text-center text-white">
      <div className="absolute inset-0 opacity-70">
        <WhenVisible minHeight={0} className="h-full"><ErrorBoundary fallback={null}><Suspense fallback={null}>
          <Aurora colorStops={["#3b5bff", "#22d3ee", "#7c5cff"]} amplitude={1.1} blend={0.55} speed={0.7} />
        </Suspense></ErrorBoundary></WhenVisible>
      </div>
      <div className="relative mx-auto max-w-3xl px-5">
        <KeyRound className="mx-auto text-cyan-300" size={34} />
        <h2 className="mt-5 text-[40px] font-extrabold leading-[1.05] md:text-[60px]">See it catch an attack <span className="font-serif font-normal italic">in real time.</span></h2>
        <p className="mx-auto mt-5 max-w-xl text-[17px] text-white/75">Launch an eavesdropper from the Attack Lab and watch the entanglement collapse, the ellipsoid bend, the verdict land on the ledger — and the AI queue it for your decision.</p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Magnetic><Link to={CONSOLE} className="btn-primary !px-6 !py-3 !text-[16px]">Open Mission Control <ArrowRight size={18} /></Link></Magnetic>
          <Magnetic><Link to={to("attacks")} className="btn !border !border-white/20 !bg-white/5 !px-6 !py-3 !text-[16px] text-white hover:!bg-white/10"><Blocks size={18} />Attack Lab</Link></Magnetic>
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="relative">
      <Nav />
      <Hero />
      <Marquee />
      <Story />
      <Detectors />
      <AiSection />
      <Numbers />
      <FinalCta />
      <footer className="border-t border-line bg-bg py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 text-[14px] text-ink-3 md:px-8">
          <Logo />
          <span>Built for Smart India Hackathon 2026 · MIT licensed</span>
          <a className="link inline-flex items-center gap-1.5" href={REPO} target="_blank" rel="noreferrer"><Github size={15} />Source</a>
        </div>
      </footer>
    </div>
  );
}
