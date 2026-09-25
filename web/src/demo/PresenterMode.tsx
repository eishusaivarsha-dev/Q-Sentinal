// Presenter Mode (docs/frontend-spec.md §9): the < 6-minute guided demo. Each step calls the real
// API, then navigates to the page that shows the result. Record it (top bar) for an offline copy.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";
import { api, errorText } from "../api/client";
import { pct } from "../lib/physics";
import { useSession } from "../state/session";
import { useUi } from "../state/ui";

interface Step { title: string; caption: string; run: (nav: NavigateFunction) => Promise<string> }

const d4 = (r: Awaited<ReturnType<typeof api.runAttack>>) => r.verdict.results.find((x) => x.detector === "D4")?.extra;

const STEPS: Step[] = [
  {
    title: "1. An honest signature",
    caption: "Alice signs; Bob measures every coin in the revealed direction. Honest signatures verify with certainty.",
    run: async (nav) => {
      const r = await api.runAttack({ attack: "honest" });
      nav(`/journey/${r.verdict.certificate.ledger_index}`);
      return `${r.decision}: ${r.verdict.certificate.transcript.total_rounds.toLocaleString()} coins, ${r.verdict.certificate.alerts.length} alarms.`;
    },
  },
  {
    title: "2. A forger guesses",
    caption: "A forger doesn't know the directions, so she guesses. Physics punishes guessing exponentially.",
    run: async (nav) => {
      const r = await api.runAttack({ attack: "blind_forgery" });
      nav(`/verdicts/${r.verdict.certificate.ledger_index}`);
      return `${r.decision} by ${r.fired}. Look at the red heatmap.`;
    },
  },
  {
    title: "3. An eavesdropper, getting bolder",
    caption: "Eve listens to 10%, then 30%, then every qubit. The error rate climbs, entanglement collapses, the sphere shrinks.",
    run: async (nav) => {
      const out: string[] = [];
      for (const s of [0.1, 0.3, 1]) {
        const r = await api.runAttack({ attack: "intercept_resend", strength: s });
        out.push(`${pct(s, 0)}: QBER ${pct(d4(r)?.qber)}, ${r.decision}`);
      }
      nav("/channels");
      return out.join(" · ") + ". Encrypt the 2 correction bits and Eve learns nothing (see the Attack Lab info meter).";
    },
  },
  {
    title: "4. A stealth probe",
    caption: "Eve listens to only a few percent, in one direction. The error rate stays under the 11% alarm, but the fingerprint names her.",
    run: async (nav) => {
      const r = await api.runAttack({ attack: "stealth_probe" });
      nav("/channels");
      const fp = d4(r)?.fingerprint;
      return `${r.decision} + warning. QBER ${pct(d4(r)?.qber)} · ${fp?.label} · estimated ${pct(fp?.est_intercept_fraction)} (true ${pct(r.strength, 0)}).`;
    },
  },
  {
    title: "5. Replay, then a stolen key store",
    caption: "Replays can only resend old classical data (no-cloning), so D5 catches them. A thief with the real keys makes a valid signature – but hits a honeypot.",
    run: async (nav) => {
      const rep = await api.runAttack({ attack: "replay" });
      const st = await api.runAttack({ attack: "stolen_key_honeypot" });
      nav(`/verdicts/${st.verdict.certificate.ledger_index}`);
      return `Replay: ${rep.decision} by ${rep.fired}. Stolen key: ${st.decision} by ${st.fired} (D2 found nothing wrong – physics alone can't catch this).`;
    },
  },
  {
    title: "6. A signer who wants to cheat",
    caption: "Alice sends Bob good coins and Charlie damaged ones. Without protection the verifiers split; with the commit-reveal shuffle they can't be split.",
    run: async (nav) => {
      const off = await api.runAttack({ attack: "repudiation_unprotected" });
      const on = await api.runAttack({ attack: "repudiation" });
      nav("/ledger");
      return `Without shuffle: Bob ${off.metrics.bob}, Charlie ${off.metrics.charlie} → dispute on the ledger. With shuffle: Bob ${on.metrics.bob}, Charlie ${on.metrics.charlie} → consistent.`;
    },
  },
  {
    title: "7. The proof",
    caption: "Every verdict is chained, signed with ML-DSA and anchored under a Merkle root. AI in trust path: NO. Here is the proof.",
    run: async (nav) => {
      await api.anchor();
      const v = await api.ledgerVerify();
      nav("/ledger");
      return `${v.detail}. Open any verdict and press “Verify in browser”, or scan its QR code.`;
    },
  },
];

export default function PresenterMode() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const close = useUi((s) => s.setPresenter);
  const replay = useSession((s) => s.replay);
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>("");
  const [started] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const step = STEPS[i];
  const go = async () => {
    setBusy(true);
    setResult("");
    try {
      setResult(await step.run(nav));
    } catch (e) {
      setResult(`Error: ${errorText(e)}`);
    } finally {
      setBusy(false);
      qc.invalidateQueries();
    }
  };
  const secs = Math.floor((now - started) / 1000);
  return (
    <div className="fixed inset-x-4 bottom-4 z-40 rounded-2xl border-2 border-cyan-500 bg-slate-950/95 p-5 shadow-2xl md:left-64">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-widest text-cyan-300">Presenter Mode · step {i + 1} of {STEPS.length} · {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}</p>
        <button className="text-sm text-slate-400 hover:text-white" onClick={() => close(false)}>Close ×</button>
      </div>
      <h2 className="mt-1 text-2xl font-semibold">{step.title}</h2>
      <p className="mt-1 text-lg text-slate-300">{step.caption}</p>
      {result && <p className="mt-2 rounded-lg bg-slate-900 p-2 text-sm text-cyan-100">{result}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded-lg border border-slate-700 px-3 py-2 text-sm disabled:opacity-40" disabled={i === 0 || busy} onClick={() => { setI(i - 1); setResult(""); }}>← Back</button>
        <button className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold disabled:opacity-40" disabled={busy || replay} onClick={go}>{busy ? "Running…" : "Run this step"}</button>
        <button className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold disabled:opacity-40" disabled={i === STEPS.length - 1 || busy} onClick={() => { setI(i + 1); setResult(""); }}>Next →</button>
        {replay && <span className="self-center text-xs text-amber-300">Replay mode is read-only – browse the recorded pages instead.</span>}
      </div>
    </div>
  );
}
