// Shapes returned by the FastAPI backend (qsentinel/api/main.py). See docs/frontend-spec.md §11.
export type Severity = "info" | "warning" | "critical";
export type Decision = "ACCEPT" | "REJECT";

export interface Health {
  status: string;
  profile: string;
  backend: string;
  basis_set: string;
  hash_bits: number;
  rounds_per_bit: number;
  tau: number;
  tau_transfer: number;
  symmetrise: boolean;
  pqc: string;
  kem: string;
  auth: "dev-open" | "api-keys";
  telemetry_mirror: string;
  verdicts: number;
  ledger_entries: number;
}

export interface Rates { Z: number; X: number; Y: number }
export interface Pauli { pX: number; pY: number; pZ: number }

export interface Fingerprint {
  rates: Rates;
  baseline_rates: Rates | null;
  pauli: Pauli | null;
  excess_pauli: Pauli | null;
  g_stat: number;
  p_value: number;
  drift: boolean;
  label: string;
  est_intercept_fraction: number | null;
}

export interface DetectorResult {
  detector: string;
  name: string;
  alert: boolean;
  severity: Severity;
  statistic: number | null;
  threshold: number | null;
  detail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra: Record<string, any>;
}

export interface MerkleProof {
  index: number;
  leaf: string;
  root: string;
  anchor_index: number;
  proof: [string, string][];
  valid?: boolean;
}

export interface Certificate {
  decision: Decision;
  issued_at: number;
  protocol: { basis_set: string; hash_bits: number; rounds_per_bit: number; tau_applied: number; transferred: boolean };
  transcript: {
    key_id: string; verifier_id: string; digest_hex: string; block_mismatches: number[];
    total_rounds: number; qber: number; rounds_per_bit: number; seed: number; backend: string;
  };
  signature: { signer_id: string; key_id: string; nonce: string; counter: number };
  link: string;
  forgery_bound_per_block: number;
  forgery_exact_per_block: number;
  channel_fingerprint: string;
  alerts: string[];
  ai_in_trust_path: false;
  transcript_hash: string;
  ledger_index: number;
  ledger_entry_hash: string;
  merkle_proof: MerkleProof | "pending";
}

export interface Verdict { decision: Decision; results: DetectorResult[]; certificate: Certificate }

export interface VerdictSummary {
  ledger_index: number;
  decision: Decision;
  issued_at: number;
  link: string;
  verifier_id: string;
  signer_id: string;
  key_id: string;
  transferred: boolean;
  alerts: { detector: string; severity: Severity; detail: string }[];
}

export interface AttackInfo {
  name: string;
  expected: string;
  detectors: string[];
  default_strength: number;
  description: string;
}

export interface AttackRun {
  attack: string;
  strength: number;
  decision: Decision;
  fired: string;
  expected: string;
  result: "PASS" | "FAIL";
  detail: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metrics: Record<string, any>;
  verdict: Verdict;
}

export interface ChannelIn {
  depolarizing?: number;
  intercept_fraction?: number;
  eve_bases?: number[];
  entangle_fraction?: number;
  entangle_basis?: number;
}

export interface LinkPoint {
  ts: number;
  ledger_index: number;
  decision: Decision;
  qber: number;
  chsh: number | null;
  fidelity: number | null;
  rates: Rates;
  baseline_rates: Rates | null;
  pauli: Pauli | null;
  excess_pauli: Pauli | null;
  fingerprint_drift: boolean;
  fingerprint: string;
  est_intercept_fraction: number | null;
  cusum: number;
  cusum_alarm: boolean;
  sprt_rounds: number;
}

export type LinkHealth = "idle" | "healthy" | "warning" | "critical";

export interface LinkStatus {
  baseline: {
    per_basis: Record<string, [number, number]>;
    qber: number;
    correlators: { ZZ: number; XX: number; YY: number };
    pairs: number;
  };
  verifications: number;
  cusum: number;
  cusum_alarms: number;
  latest: LinkPoint | null;
  status: LinkHealth;
  history: LinkPoint[];
}

export interface VerdictEventData extends LinkPoint {
  verifier_id: string;
  signer_id: string;
  key_id: string;
  link: string;
  transferred: boolean;
  alerts: DetectorResult[];
}

export type TelemetryEvent =
  | { seq: number; ts: number; kind: "verdict"; data: VerdictEventData }
  | { seq: number; ts: number; kind: "key_issued"; data: { signer_id: string; key_id: string } }
  | { seq: number; ts: number; kind: "ledger_entry"; data: { index: number; kind: string; entry_hash: string; decision?: string; link?: string; root?: string } };

export interface Overview {
  verdicts: { total: number; accept: number; reject: number };
  alerts: { critical: number; warning: number };
  links: Record<string, LinkHealth>;
  ledger: { entries: number; chain_ok: boolean; detail: string; anchors: number; last_anchor_index: number | null; unanchored: number };
  disputes: number;
}

export interface LedgerEntry {
  index: number;
  timestamp: number;
  kind: string;
  prev_hash: string;
  payload_hash: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: Record<string, any>;
  entry_hash: string;
  signature: string;
}

export interface Dispute {
  key_id: string;
  nonce: string;
  finding: string;
  verdicts: Record<string, { decision: Decision; transferred: boolean }>;
}

export interface Audit {
  chain_ok: boolean;
  chain_detail: string;
  anchor_problems: string[];
  symmetrisation: { committed: number; revealed: number; unrevealed: string[]; problems: string[] };
  disputes: Dispute[];
  ok: boolean;
}

export interface SweepRow {
  attack: string;
  strength: number;
  trials: number;
  reject_rate: number;
  alert_rate: number;
  pass_rate: number;
  mean_qber: number | null;
  [detectorRate: string]: number | string | null;
}

export interface CalibrationRow { tau: number; two_basis_n: number; six_state_n: number }

export interface Incident {
  id: number;
  size: number;
  event_seqs: number[];
  ledger_indices: (number | null)[];
  links: string[];
  detectors: string[];
  critical: number;
  fingerprints: string[];
  first_ts: number;
  last_ts: number;
  mean_qber: number;
  narrative: string;
}

export interface OpsResult { label: string; alerts: number; incidents: Incident[]; reduction: number }

export interface Participants { signers: string[]; verifiers: string[]; honeypots: number }

export interface TeleportResult {
  input_bloch: [number, number, number];
  bsm_probabilities: Record<"00" | "01" | "10" | "11", number>;
  bsm: "00" | "01" | "10" | "11";
  correction: "I" | "X" | "Z" | "XZ";
  received_bloch: [number, number, number];
  output_bloch: [number, number, number];
  fidelity: number;
  error_rate: number;
  basis: number | null;
  six_state_error_rate: number;
  qasm: string;
}

export interface BsmResult { shots: number; counts: Record<string, number>; chi2: number; p_value: number; uniform: boolean }

export interface FarResult {
  n: number; tau: number; noise: number; limit: number; trials: number; false_alarms: number;
  far_empirical: number; far_exact: number; ci95: [number, number]; chernoff_bound: number; hoeffding_bound: number;
  exact_inside_ci: boolean;
}

export interface AcceptanceCheck {
  id: string; title: string; criterion: string; passed: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  evidence: Record<string, any>;
}
export interface Acceptance { generated_at: number; seconds: number; mode: string; passed: boolean; checks: AcceptanceCheck[] }

export interface HoltSeries { level: number; trend: number; sigma: number; forecast: number[]; low: number[]; high: number[]; history: number[] }
export interface LinkForecast {
  link: string; status: string; points: number; risk: "unknown" | "low" | "watch" | "elevated" | "high";
  steps_to_breach?: number | null; note?: string;
  qber?: HoltSeries & { steps_to_alarm: number | null };
  chsh?: HoltSeries & { steps_to_classical: number | null };
}
export interface ForecastResult { label: string; horizon: number; links: LinkForecast[] }

export interface Anomaly { ledger_index: number; link: string; decision: Decision; ts: number; score: number; qber: number; drivers: string[] }
export interface AnomalyResult { label: string; scored: number; anomalies: Anomaly[]; note?: string }

export interface CopilotStatus { label: string; mode: "claude" | "offline"; model: string }

// --- fraud review: the AI advises (ops plane), the analyst decides (kernel ledger) ---------------
export type Disposition = "confirm_fraud" | "escalate" | "monitor" | "dismiss";
export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Review {
  index: number;
  timestamp: number;
  entry_hash: string;
  verdict_index?: number;
  verdict_decision?: Decision;
  decision: Disposition;
  note: string;
  reviewer: string;
  agreed_with_ai: boolean | null;
  advisory?: { risk: number; level: RiskLevel; category: string; recommendation: Disposition; label: string } | null;
}

export interface FraudCase {
  label: string;
  ledger_index: number;
  ts: number;
  decision: Decision;
  link: string;
  signer_id: string;
  verifier_id: string;
  key_id: string;
  risk: number;
  level: RiskLevel;
  category: string;
  reasons: string[];
  detectors: string[];
  recommendation: Disposition;
  recommendation_text: string;
  containment: string[];
  confidence: "low" | "medium" | "high";
  review: Pick<Review, "index" | "timestamp" | "decision" | "note" | "reviewer" | "agreed_with_ai" | "entry_hash"> | null;
}

export interface FraudQueue {
  label: string;
  scanned: number;
  flagged: number;
  open: number;
  by_level: Record<"critical" | "high" | "medium", number>;
  agreement: number | null;
  cases: FraudCase[];
}
