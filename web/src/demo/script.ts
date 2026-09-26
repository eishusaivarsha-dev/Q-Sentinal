// The < 6-minute guided demo (docs/frontend-spec.md §9). Each step calls the real API, then
// navigates to the page that shows the result. In replay mode the same calls are answered from the
// recorded session, so the whole script also runs offline.
import type { NavigateFunction } from "react-router-dom";
import { api } from "@/api/client";
import { pct } from "@/lib/format";

export interface DemoStep { title: string; caption: string; seconds: number; run: (nav: NavigateFunction) => Promise<string> }

type Run = Awaited<ReturnType<typeof api.runAttack>>;
const d4 = (r: Run) => r.verdict.results.find((x) => x.detector === "D4")?.extra;

export const SCRIPT: DemoStep[] = [
  {
    title: "Commission and honest",
    seconds: 40,
    caption: "Alice signs; Bob measures every coin in the revealed direction. Honest signatures verify with certainty.",
    run: async (nav) => {
      const r = await api.runAttack({ attack: "honest" });
      nav(`/journey/${r.verdict.certificate.ledger_index}`);
      return `${r.decision}: ${r.verdict.certificate.transcript.total_rounds.toLocaleString()} coins, ${r.verdict.certificate.alerts.length} alarms.`;
    },
  },
  {
    title: "A forger guesses",
    seconds: 40,
    caption: "A forger doesn't know the directions, so she guesses. Physics punishes guessing exponentially.",
    run: async (nav) => {
      const r = await api.runAttack({ attack: "blind_forgery" });
      nav(`/verdicts/${r.verdict.certificate.ledger_index}`);
      return `${r.decision} by ${r.fired}. Look at the red heatmap and the 10⁻¹⁶ bound.`;
    },
  },
  {
    title: "An eavesdropper, getting bolder",
    seconds: 70,
    caption: "Eve listens to 10%, then 30%, then every qubit. The error rate climbs, entanglement collapses, the sphere shrinks. Encrypt the two correction bits and Eve learns nothing.",
    run: async (nav) => {
      const out: string[] = [];
      for (const s of [0.1, 0.3, 1]) {
        const r = await api.runAttack({ attack: "intercept_resend", strength: s });
        out.push(`${pct(s, 0)}: QBER ${pct(d4(r)?.qber)}, ${r.decision}`);
      }
      nav("/channels");
      return out.join(" · ");
    },
  },
  {
    title: "A stealth probe",
    seconds: 50,
    caption: "Eve listens to only a few percent, in one direction. The error rate stays under the 11% alarm, but the fingerprint names her: the ellipsoid becomes a Z-cigar.",
    run: async (nav) => {
      const r = await api.runAttack({ attack: "stealth_probe" });
      nav("/channels");
      const fp = d4(r)?.fingerprint;
      return `${r.decision} + warning. QBER ${pct(d4(r)?.qber)} · ${fp?.label} · estimated ${pct(fp?.est_intercept_fraction)} (true ${pct(r.strength, 0)}).`;
    },
  },
  {
    title: "Replay, then a stolen keystore",
    seconds: 40,
    caption: "Replays can only resend old classical data (no-cloning), so D5 catches them. A thief with the real keys makes a valid signature — but trips a honeypot.",
    run: async (nav) => {
      const rep = await api.runAttack({ attack: "replay" });
      const st = await api.runAttack({ attack: "stolen_key_honeypot" });
      nav(`/verdicts/${st.verdict.certificate.ledger_index}`);
      return `Replay: ${rep.decision} by ${rep.fired}. Stolen key: ${st.decision} by ${st.fired} (D2 found nothing wrong — physics alone can't catch this).`;
    },
  },
  {
    title: "A signer who wants to cheat",
    seconds: 60,
    caption: "Alice sends Bob good coins and Charlie damaged ones. Without protection the verifiers split; with the commit-reveal shuffle they can't be split. The blockchain isn't decoration.",
    run: async (nav) => {
      const off = await api.runAttack({ attack: "repudiation_unprotected" });
      const on = await api.runAttack({ attack: "repudiation" });
      nav("/transferability");
      return `Without shuffle: Bob ${off.metrics.bob}, Charlie ${off.metrics.charlie} → dispute on the ledger. With shuffle: Bob ${on.metrics.bob}, Charlie ${on.metrics.charlie} → consistent.`;
    },
  },
  {
    title: "The proof",
    seconds: 60,
    caption: "Every verdict is chained, signed with ML-DSA and anchored under a Merkle root. AI in trust path: NO. Here is the proof.",
    run: async (nav) => {
      await api.anchor();
      const v = await api.ledgerVerify();
      nav("/ledger");
      return `${v.detail}. Open any verdict and press “Verify in browser”, or scan its QR code.`;
    },
  },
];

export const SCRIPT_BUDGET = SCRIPT.reduce((s, x) => s + x.seconds, 0);
