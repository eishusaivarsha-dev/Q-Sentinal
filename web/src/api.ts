// Thin client for the FastAPI backend (qsentinel/api/main.py).
export const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type Severity = "info" | "warning" | "critical";

export interface DetectorResult {
  detector: string;
  name: string;
  alert: boolean;
  severity: Severity;
  statistic: number | null;
  threshold: number | null;
  detail: string;
}

export interface Verdict {
  decision: "ACCEPT" | "REJECT";
  results: DetectorResult[];
  certificate: Record<string, unknown>;
}

export interface AttackRun {
  attack: string;
  strength: number;
  decision: string;
  fired: string;
  expected: string;
  result: "PASS" | "FAIL";
  detail: string;
  verdict: Verdict;
}

export interface TelemetryEvent {
  seq: number;
  ts: number;
  kind: string;
  data: {
    decision?: string;
    qber?: number;
    chsh?: number | null;
    verifier_id?: string;
    alerts?: DetectorResult[];
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

export const api = {
  health: () => fetch(`${API}/health`).then((r) => r.json()),
  attacks: () =>
    fetch(`${API}/attacks`).then((r) => r.json()) as Promise<
      { name: string; expected: string; detectors: string[] }[]
    >,
  runAttack: (attack: string, strength: number) =>
    post<AttackRun>("/attacks/run", { attack, strength }),
};

export function subscribeTelemetry(onEvent: (e: TelemetryEvent) => void): () => void {
  const ws = new WebSocket(API.replace(/^http/, "ws") + "/ws/telemetry");
  ws.onmessage = (m) => onEvent(JSON.parse(m.data));
  return () => ws.close();
}
