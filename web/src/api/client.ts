// Thin client for the FastAPI backend and the advisory ops service. The browser never decides a
// verdict: it only displays what these endpoints return.
import { useSession } from "@/state/session";
import type {
  Acceptance, AnomalyResult, AttackInfo, AttackRun, Audit, BsmResult, CalibrationRow, ChannelIn, CopilotStatus, FarResult,
  Disposition, ForecastResult, FraudCase, FraudQueue, Health, LedgerEntry, LinkStatus, MerkleProof, OpsResult, Overview, Participants, SweepRow, TeleportResult,
  Review, RiskLevel, TelemetryEvent, Verdict, VerdictSummary,
} from "./types";

// Dev: separate servers on :8000 / :8100. The all-in-one image builds with /api and /ops (same origin).
export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const OPS_URL: string = import.meta.env.VITE_OPS_URL ?? "http://localhost:8100";

/** Absolute URL for a path on the API (QR codes and WebSockets need absolute URLs). */
export function absoluteApi(path: string, base = API_URL): string {
  return new URL(base + path, window.location.href).href;
}

export function wsUrl(path: string): string {
  return absoluteApi(path).replace(/^http/, "ws");
}

// The API key lives in sessionStorage only. It is never put in a URL, except the WebSocket
// `?key=` that the backend requires (state/telemetry.ts).
const KEY_NAME = "qs-api-key";
export function getApiKey(): string {
  try {
    return sessionStorage.getItem(KEY_NAME) ?? "";
  } catch {
    return "";
  }
}
export function setApiKey(key: string) {
  try {
    if (key) sessionStorage.setItem(KEY_NAME, key);
    else sessionStorage.removeItem(KEY_NAME);
  } catch {
    /* storage blocked: key lasts only for this page */
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, base = API_URL): Promise<T> {
  const session = useSession.getState();
  const method = (init.method ?? "GET").toUpperCase();
  const url = base + path;
  const body = typeof init.body === "string" ? init.body : undefined;
  if (session.replay) {
    const hit = session.lookup(url, method, body);
    if (hit !== undefined) return hit as T;
    throw new ApiError(409, method === "GET" ? "Not in the recorded session" : "This action was not recorded in the session");
  }
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const key = getApiKey();
  if (key) headers.set("X-API-Key", key);
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch {
    throw new ApiError(0, `Cannot reach ${base}`);
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(res.status, msg);
  }
  const data = (await res.json()) as T;
  session.record(url, method, data, body);
  return data;
}

function post<T>(path: string, body?: unknown, base = API_URL) {
  return request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, base);
}

export const api = {
  health: () => request<Health>("/health"),
  overview: () => request<Overview>("/overview"),
  participants: () => request<Participants>("/participants"),
  links: (history = 100) => request<Record<string, LinkStatus>>(`/links?history=${history}`),
  verdicts: (limit = 50) => request<VerdictSummary[]>(`/verdicts?limit=${limit}`),
  verdict: (index: number) => request<Verdict>(`/verdicts/${index}`),
  attacks: () => request<AttackInfo[]>("/attacks"),
  runAttack: (body: { attack: string; strength?: number | null; seed?: number; channel?: ChannelIn }) =>
    post<AttackRun>("/attacks/run", body),
  sweep: (body: { attack: string; min?: number; max?: number; steps?: number; trials?: number; noise?: number; full?: boolean }) =>
    post<SweepRow[]>("/sweeps", body),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sign: (message: string, signer_id = "alice") => post<Record<string, any>>("/sign", { message, signer_id }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  verify: (signature: Record<string, any>, verifier_id = "bob", channel: ChannelIn = {}, transferred = false) =>
    post<Verdict>("/verify", { signature, verifier_id, channel, transferred }),
  ledger: (limit = 60, kind?: string) => request<LedgerEntry[]>(`/ledger?limit=${limit}${kind ? `&kind=${kind}` : ""}`),
  ledgerVerify: () => request<{ ok: boolean; detail: string }>("/ledger/verify"),
  audit: () => request<Audit>("/ledger/audit"),
  anchor: () => post<{ anchored: boolean; entry: LedgerEntry | null }>("/ledger/anchor"),
  proof: (index: number) => request<MerkleProof>(`/ledger/proof/${index}`),
  calibration: () => request<CalibrationRow[]>("/calibration"),
  far: (n: number, tau: number, noise: number, trials = 100_000) =>
    request<FarResult>(`/calibration/far?n=${n}&tau=${tau}&noise=${noise}&trials=${trials}`),
  telemetry: (since = 0) => request<TelemetryEvent[]>(`/telemetry?since=${since}`),
  honeypot: (signer = "alice") => post<{ key_id: string }>(`/honeypots/${signer}`),
  teleport: (body: { state?: string | null; theta?: number; phi?: number; channel?: ChannelIn; seed?: number }) =>
    post<TeleportResult>("/quantum/teleport", body),
  bsm: (shots: number, channel: ChannelIn = {}) => post<BsmResult>("/quantum/bsm", { shots, channel }),
  reviews: (verdictIndex?: number) => request<Review[]>(`/reviews${verdictIndex !== undefined ? `?verdict_index=${verdictIndex}` : ""}`),
  /** The analyst's decision: signed onto the kernel's ledger. The AI's advice is attached for the audit trail only. */
  review: (index: number, body: {
    decision: Disposition; note?: string; reviewer?: string;
    advisory?: { risk: number; level: RiskLevel; category: string; recommendation: Disposition } | null;
  }) => post<Review>(`/reviews/${index}`, body),
  acceptance: (refresh = false) => request<Acceptance>(`/report/acceptance${refresh ? "?refresh=true" : ""}`),
  // advisory ops plane
  incidents: () => request<OpsResult>("/incidents", {}, OPS_URL),
  forecast: () => request<ForecastResult>("/forecast", {}, OPS_URL),
  anomalies: () => request<AnomalyResult>("/anomalies", {}, OPS_URL),
  fraudQueue: (minRisk = 25, openOnly = false) => request<FraudQueue>(`/fraud/queue?min_risk=${minRisk}&open_only=${openOnly}&limit=60`, {}, OPS_URL),
  fraudCase: (index: number) => request<FraudCase>(`/fraud/cases/${index}`, {}, OPS_URL),
  copilotStatus: () => request<CopilotStatus>("/copilot/status", {}, OPS_URL),
  opsHealth: () => request<{ status: string; label: string; api: string; copilot: string }>("/health", {}, OPS_URL),
};

export interface ChatTurn { role: "user" | "assistant"; content: string }

/** Streams a Sentinel Copilot answer (server-sent events). Calls onDelta for every text chunk. */
export async function streamCopilot(question: string, history: ChatTurn[], onDelta: (text: string) => void,
  onMeta?: (m: { mode: string; model: string; label: string }) => void, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${OPS_URL}/copilot/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history }), signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    throw new ApiError(0, `Cannot reach the advisory service at ${OPS_URL}`);
  }
  if (!res.ok || !res.body) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* not JSON */
    }
    throw new ApiError(res.status, msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      const event = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === "delta") onDelta(payload.text);
      else if (event === "meta") onMeta?.(payload);
    }
  }
}

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.status ? `${e.status}: ${e.message}` : e.message;
  return e instanceof Error ? e.message : String(e);
}
