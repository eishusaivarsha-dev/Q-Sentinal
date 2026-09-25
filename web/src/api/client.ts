// Thin client for the FastAPI backend and the advisory ops service. The browser never decides a
// verdict: it only displays what these endpoints return.
import { useSession } from "../state/session";
import type {
  AttackInfo, AttackRun, Audit, CalibrationRow, ChannelIn, Health, LedgerEntry, LinkStatus, MerkleProof,
  OpsResult, Overview, Participants, SweepRow, TelemetryEvent, Verdict, VerdictSummary,
} from "./types";

export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
export const OPS_URL: string = import.meta.env.VITE_OPS_URL ?? "http://localhost:8100";

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
  if (session.replay) {
    const hit = session.lookup(url, method);
    if (hit !== undefined) return hit as T;
    throw new ApiError(409, method === "GET" ? "Not in the recorded session" : "Replay mode is read-only");
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
  session.record(url, method, data);
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
  telemetry: (since = 0) => request<TelemetryEvent[]>(`/telemetry?since=${since}`),
  honeypot: (signer = "alice") => post<{ key_id: string }>(`/honeypots/${signer}`),
  incidents: () => request<OpsResult>("/incidents", {}, OPS_URL),
  opsHealth: () => request<{ status: string; label: string; api: string }>("/health", {}, OPS_URL),
};

export function errorText(e: unknown): string {
  if (e instanceof ApiError) return e.status ? `${e.status}: ${e.message}` : e.message;
  return e instanceof Error ? e.message : String(e);
}
