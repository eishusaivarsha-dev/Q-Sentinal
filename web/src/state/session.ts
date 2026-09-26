// Session recorder / offline replay (docs/frontend-spec.md §9): record every REST response and
// telemetry event of a live demo, download it as JSON, and replay it later with no backend.
// POST responses are replayed in the order they were recorded, so Presenter Mode can re-run its
// attacks offline and get exactly the verdicts the live backend issued.
import { create } from "zustand";
import type { TelemetryEvent } from "@/api/types";

interface Recorded { url: string; method: string; data: unknown; t: number; body?: string }

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
  /** indices of recorded POST responses already handed out during this replay */
  usedPosts: Set<number>;
  start(): void;
  stop(): SessionFile;
  record(url: string, method: string, data: unknown, body?: string): void;
  recordEvent(e: TelemetryEvent): void;
  lookup(url: string, method: string, body?: string): unknown | undefined;
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
  usedPosts: new Set(),
  start: () => set({ recording: true, startedAt: Date.now(), items: [], events: [] }),
  stop: () => {
    const { startedAt, items, events } = get();
    set({ recording: false });
    return { version: 1, startedAt, items, events };
  },
  record: (url, method, data, body) => {
    if (get().recording) set((s) => ({ items: [...s.items, { url, method, data, t: Date.now(), body }] }));
  },
  recordEvent: (e) => {
    if (get().recording) set((s) => ({ events: [...s.events, e] }));
  },
  lookup: (url, method, body) => {
    const items = get().replayItems;
    if (method !== "GET") {
      const used = get().usedPosts;
      const match = (strict: boolean) =>
        items.findIndex((it, i) => !used.has(i) && it.method === method && it.url === url && (!strict || it.body === body));
      let i = match(true);
      if (i < 0) i = match(false);
      if (i < 0) return undefined;
      used.add(i);
      return items[i].data;
    }
    const bare = url.split("?")[0];
    for (let i = items.length - 1; i >= 0; i--) if (items[i].method === "GET" && items[i].url === url) return items[i].data;
    for (let i = items.length - 1; i >= 0; i--) if (items[i].method === "GET" && items[i].url.split("?")[0] === bare) return items[i].data;
    return undefined;
  },
  enterReplay: (f) => set({ replay: true, recording: false, replayItems: f.items, usedPosts: new Set() }),
  exitReplay: () => set({ replay: false, replayItems: [], usedPosts: new Set() }),
}));

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
