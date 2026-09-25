// Session recorder / offline replay (docs/frontend-spec.md §9): record every REST response and
// telemetry event of a live demo, download it as JSON, and replay it later with no backend.
import { create } from "zustand";
import type { TelemetryEvent } from "../api/types";

interface Recorded { url: string; method: string; data: unknown; t: number }

export interface SessionFile {
  version: 1;
  startedAt: number;
  items: Recorded[];
  events: TelemetryEvent[];
}

interface SessionState {
  recording: boolean;
  startedAt: number;
  items: Recorded[];
  events: TelemetryEvent[];
  replay: boolean;
  replayItems: Recorded[];
  start(): void;
  stop(): SessionFile;
  record(url: string, method: string, data: unknown): void;
  recordEvent(e: TelemetryEvent): void;
  lookup(url: string, method: string): unknown | undefined;
  enterReplay(f: SessionFile): void;
  exitReplay(): void;
}

export const useSession = create<SessionState>((set, get) => ({
  recording: false,
  startedAt: 0,
  items: [],
  events: [],
  replay: false,
  replayItems: [],
  start: () => set({ recording: true, startedAt: Date.now(), items: [], events: [] }),
  stop: () => {
    const { startedAt, items, events } = get();
    set({ recording: false });
    return { version: 1, startedAt, items, events };
  },
  record: (url, method, data) => {
    if (get().recording) set((s) => ({ items: [...s.items, { url, method, data, t: Date.now() }] }));
  },
  recordEvent: (e) => {
    if (get().recording) set((s) => ({ events: [...s.events, e] }));
  },
  lookup: (url, method) => {
    if (method !== "GET") return undefined;
    const items = get().replayItems;
    const bare = url.split("?")[0];
    for (let i = items.length - 1; i >= 0; i--) if (items[i].method === "GET" && items[i].url === url) return items[i].data;
    for (let i = items.length - 1; i >= 0; i--) if (items[i].method === "GET" && items[i].url.split("?")[0] === bare) return items[i].data;
    return undefined;
  },
  enterReplay: (f) => set({ replay: true, recording: false, replayItems: f.items }),
  exitReplay: () => set({ replay: false, replayItems: [] }),
}));

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
