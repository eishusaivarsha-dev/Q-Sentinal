// Attack-class chip: deterministic presentation rules (docs/frontend-spec.md §8). Not ML, and it
// never changes a decision - it only puts the detector output into words.
// Key ordering: D3 measures spare Bell pairs no signature touches, so a clean D3 with a failed D2
// means "the signature is bad", while a disturbed D3 means "someone is on the channel".
import type { AttackGlyphName } from "@/components/art/AttackGlyph";
import type { DetectorResult, Verdict, VerdictEventData } from "@/api/types";

export type Tone = "bad" | "warn" | "ok" | "info";
export interface AttackClass { label: string; tone: Tone }

interface Input {
  decision: string;
  keyId: string;
  alerts: DetectorResult[]; // only detectors that fired (warning or critical)
  fingerprintDrift: boolean;
  fingerprintLabel: string;
  disputedKeys?: Set<string>;
}

export function attackClass(i: Input): AttackClass {
  const fired = (d: string) => i.alerts.find((a) => a.detector === d && a.alert && a.severity !== "info");
  const bad: Tone = i.decision === "REJECT" ? "bad" : "warn";
  const single = i.fingerprintDrift && i.fingerprintLabel.startsWith("single-axis");
  const d6 = fired("D6");
  if (i.disputedKeys?.has(i.keyId)) return { label: "Repudiation attempt", tone: "bad" };
  if (d6?.extra?.honeypot) return { label: "Stolen keystore (honeypot)", tone: "bad" };
  if (d6 && d6.detail.includes("not authorised")) return { label: "Unauthorised verification", tone: "bad" };
  if (d6) return { label: "Impersonation", tone: "bad" };
  if (fired("D5") && fired("D2")) return { label: "Key-reuse forgery", tone: "bad" };
  if (fired("D5")) return { label: "Replay", tone: "bad" };
  if (fired("D3") || single) {
    if (single) {
      const axis = i.fingerprintLabel.split("along ")[1]?.[0] ?? "?";
      return { label: `Probe in ${axis} basis${i.decision === "ACCEPT" ? " (stealth)" : ""}`, tone: bad };
    }
    return { label: "Intercept-resend / entanglement attack", tone: bad };
  }
  if (fired("D2")) return { label: "Forgery / message tampering", tone: "bad" };
  const d4 = fired("D4");
  if (d4?.severity === "critical") return { label: "Intercept-resend (channel)", tone: "bad" };
  if (d4?.extra?.cusum_alarm) return { label: "Sustained low-level channel attack", tone: "warn" };
  if (i.fingerprintDrift) return { label: "Low-level channel anomaly", tone: "warn" };
  return { label: "Nominal", tone: "ok" };
}

export function classOfVerdict(v: Verdict, disputedKeys?: Set<string>): AttackClass {
  const fp = v.results.find((r) => r.detector === "D4")?.extra?.fingerprint ?? {};
  return attackClass({
    decision: v.decision,
    keyId: v.certificate.signature.key_id,
    alerts: v.results.filter((r) => r.alert && r.severity !== "info"),
    fingerprintDrift: Boolean(fp.drift),
    fingerprintLabel: fp.label ?? "",
    disputedKeys,
  });
}

export function classOfEvent(d: VerdictEventData, disputedKeys?: Set<string>): AttackClass {
  return attackClass({
    decision: d.decision,
    keyId: d.key_id,
    alerts: d.alerts,
    fingerprintDrift: d.fingerprint_drift,
    fingerprintLabel: d.fingerprint,
    disputedKeys,
  });
}

// ---------------------------------------------------------------------------------------------
// Copy deck (spec §12) and illustration vocabulary. Words and pictures only.

export type DetectorId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
export const DETECTOR_IDS: DetectorId[] = ["D1", "D2", "D3", "D4", "D5", "D6"];

export const DETECTORS: Record<DetectorId, { name: string; law: string; instrument: string }> = {
  D1: { name: "Eigenstate consistency", instrument: "Rotor comparator",
    law: "Honest signatures are eigenstates: every measurement must come out exactly as revealed." },
  D2: { name: "Forgery test", instrument: "Block tally drum",
    law: "A forger must guess the basis of every qubit; each wrong guess shows up as a mismatch with probability ≥ 1/3." },
  D3: { name: "Entanglement (CHSH)", instrument: "Bell meter",
    law: "Real entanglement beats the classical limit S = 2. If S falls to 2, the channel was tampered with." },
  D4: { name: "Channel forensics", instrument: "Channel ellipsoid",
    law: "Eavesdropping leaves errors. Which basis the errors hit reveals how she is listening." },
  D5: { name: "Freshness", instrument: "Nonce register",
    law: "Physics forbids copying the quantum key, so a replay can only be an old classical message; nonces and one-time keys stop it." },
  D6: { name: "Identity binding", instrument: "Custody register",
    law: "Keys are bound to their owner and verifiers to their role. Decoy keys catch stolen keystores." },
};

export interface AttackCopy { label: string; code: string; oneLiner: string; glyph: AttackGlyphName }

/** Keyed by the backend's attack names (GET /attacks). */
export const ATTACK_COPY: Record<string, AttackCopy> = {
  honest: { label: "Honest signature", code: "H-00", oneLiner: "The control: a genuine signature on a clean channel.", glyph: "badge" },
  blind_forgery: { label: "Blind forgery", code: "F-01", oneLiner: "Guesses everything.", glyph: "dice" },
  known_basis_partial_forgery: { label: "Partial-key forgery", code: "F-02", oneLiner: "Knows part of the key.", glyph: "key" },
  intercept_resend: { label: "Intercept-resend", code: "Q-01", oneLiner: "Measures qubits in transit.", glyph: "eye" },
  entangle_and_measure: { label: "Entangle-and-measure", code: "Q-02", oneLiner: "Copies qubits into her own memory.", glyph: "link" },
  stealth_probe: { label: "Stealth probe", code: "Q-03", oneLiner: "Listens to so few qubits that the error rate stays “normal”.", glyph: "ear" },
  replay: { label: "Replay", code: "C-01", oneLiner: "Re-sends an old signature.", glyph: "loop" },
  key_reuse_forgery: { label: "Key-reuse forgery", code: "C-02", oneLiner: "Reuses a spent one-time key.", glyph: "recycle" },
  mitm_message_swap: { label: "MITM swap", code: "C-03", oneLiner: "Changes the message, keeps the signature.", glyph: "swap" },
  repudiation: { label: "Repudiation (protected)", code: "P-01", oneLiner: "The signer cheats so she can deny later — against the commit-reveal shuffle.", glyph: "mask" },
  repudiation_unprotected: { label: "Repudiation (unprotected)", code: "P-01u", oneLiner: "The signer cheats so she can deny later — no shuffle.", glyph: "mask" },
  impersonation: { label: "Impersonation", code: "P-02", oneLiner: "Claims someone else’s key.", glyph: "badge" },
  unauthorised_verification: { label: "Unauthorised verification", code: "P-03", oneLiner: "Someone without the right tries to verify.", glyph: "lock" },
  stolen_key_honeypot: { label: "Stolen keystore", code: "P-04", oneLiner: "Signs with a stolen key.", glyph: "safe" },
};

export function attackCopy(name: string): AttackCopy {
  return ATTACK_COPY[name] ?? { label: name.replaceAll("_", " "), code: "X-??", oneLiner: "", glyph: "dice" };
}

/** Which backend attacks a chip label corresponds to (spec §8 validation table). */
export function attacksForClass(label: string): string[] {
  if (label.startsWith("Probe in")) return ["stealth_probe", "entangle_and_measure"];
  if (label.startsWith("Intercept-resend")) return ["intercept_resend"];
  if (label.startsWith("Forgery")) return ["blind_forgery", "known_basis_partial_forgery", "mitm_message_swap"];
  if (label.startsWith("Stolen keystore")) return ["stolen_key_honeypot"];
  if (label === "Repudiation attempt") return ["repudiation_unprotected"];
  const direct: Record<string, string> = {
    Replay: "replay", "Key-reuse forgery": "key_reuse_forgery", Impersonation: "impersonation",
    "Unauthorised verification": "unauthorised_verification",
  };
  return direct[label] ? [direct[label]] : [];
}

/** Illustration to show beside a chip label. */
export function glyphForClass(label: string): AttackGlyphName {
  const a = attacksForClass(label)[0];
  if (a) return attackCopy(a).glyph;
  return label === "Nominal" ? "badge" : "ear";
}
