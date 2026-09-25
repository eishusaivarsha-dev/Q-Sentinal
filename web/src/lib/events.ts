import type { TelemetryEvent, VerdictEventData } from "../api/types";

export type VerdictEvent = { seq: number; ts: number; kind: "verdict"; data: VerdictEventData };

export const isVerdictEvent = (e: TelemetryEvent): e is VerdictEvent => e.kind === "verdict";

export function verdictEvents(events: TelemetryEvent[]): VerdictEvent[] {
  return events.filter(isVerdictEvent);
}
