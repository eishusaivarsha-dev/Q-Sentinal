// Live telemetry store (one-way feed from the trust kernel) + WebSocket connection + toasts.
import { useEffect } from "react";
import { create } from "zustand";
import { API_URL, getApiKey } from "../api/client";
import type { TelemetryEvent } from "../api/types";
import { classOfEvent } from "../lib/attribution";
import { useSession, type SessionFile } from "./session";

export interface Toast { id: number; title: string; body: string; ledgerIndex?: number }
type Status = "connecting" | "live" | "down" | "replay";

interface TelemetryState {
  events: TelemetryEvent[];
  lastSeq: number;
  status: Status;
  toasts: Toast[];
  add(events: TelemetryEvent[]): void;
  setStatus(s: Status): void;
  reset(): void;
  dismiss(id: number): void;
}

const APP_START = Date.now() / 1000;
const MAX_EVENTS = 5000;
let toastId = 0;

export const useTelemetry = create<TelemetryState>((set) => ({
  events: [],
  lastSeq: 0,
  status: "connecting",
  toasts: [],
  add: (incoming) =>
    set((s) => {
      const fresh = incoming.filter((e) => e.seq > s.lastSeq);
      if (!fresh.length) return s;
      const toasts = [...s.toasts];
      for (const e of fresh) {
        if (e.kind === "verdict" && e.data.decision === "REJECT" && e.ts > APP_START - 2) {
          const top = e.data.alerts.find((a) => a.severity === "critical") ?? e.data.alerts[0];
          toasts.push({
            id: ++toastId,
            title: `REJECT · ${classOfEvent(e.data).label}`,
            body: `${e.data.link} · ${top ? `${top.detector}: ${top.detail}` : "signature rejected"}`,
            ledgerIndex: e.data.ledger_index,
          });
        }
      }
      return {
        events: [...s.events, ...fresh].slice(-MAX_EVENTS),
        lastSeq: fresh[fresh.length - 1].seq,
        toasts: toasts.slice(-4),
      };
    }),
  setStatus: (status) => set({ status }),
  reset: () => set({ events: [], lastSeq: 0 }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Keeps one WebSocket open to /ws/telemetry (reconnects every 2 s). Paused in replay mode. */
export function useTelemetryConnection() {
  const replay = useSession((s) => s.replay);
  useEffect(() => {
    if (replay) return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let timer: number | undefined;
    const open = () => {
      const { lastSeq, setStatus } = useTelemetry.getState();
      setStatus("connecting");
      const key = getApiKey();
      ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws/telemetry?since=${lastSeq}${key ? `&key=${encodeURIComponent(key)}` : ""}`);
      ws.onopen = () => useTelemetry.getState().setStatus("live");
      ws.onmessage = (m) => {
        const e = JSON.parse(m.data) as TelemetryEvent;
        useTelemetry.getState().add([e]);
        useSession.getState().recordEvent(e);
      };
      ws.onclose = () => {
        useTelemetry.getState().setStatus("down");
        if (!stopped) timer = window.setTimeout(open, 2000);
      };
    };
    open();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      ws?.close();
    };
  }, [replay]);
}

let replayTimers: number[] = [];

/** Plays a recorded session's telemetry back with its original timing (gaps capped at 2 s). */
export function startReplay(file: SessionFile) {
  stopReplayTimers();
  useSession.getState().enterReplay(file);
  const t = useTelemetry.getState();
  t.reset();
  t.setStatus("replay");
  let delay = 0;
  let prev = file.events[0]?.ts ?? 0;
  for (const e of file.events) {
    delay += Math.min(2, Math.max(0, e.ts - prev)) * 1000;
    prev = e.ts;
    replayTimers.push(window.setTimeout(() => useTelemetry.getState().add([{ ...e, ts: Date.now() / 1000 }]), delay));
  }
}

export function stopReplay() {
  stopReplayTimers();
  useSession.getState().exitReplay();
  useTelemetry.getState().reset();
}

function stopReplayTimers() {
  replayTimers.forEach((id) => window.clearTimeout(id));
  replayTimers = [];
}
