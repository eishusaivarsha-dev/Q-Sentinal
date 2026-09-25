// Attack-class chip: deterministic presentation rules (docs/frontend-spec.md §8). Not ML, and it
// never changes a decision - it only puts the detector output into words.
// Key ordering: D3 measures spare Bell pairs no signature touches, so a clean D3 with a failed D2
// means "the signature is bad", while a disturbed D3 means "someone is on the channel".
import type { DetectorResult, Verdict, VerdictEventData } from "../api/types";

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
