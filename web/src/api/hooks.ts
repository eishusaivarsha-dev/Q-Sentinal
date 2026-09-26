// Shared TanStack Query hooks, so every page reads the same cached data (spec §6 refresh rates).
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "./client";

export const useHealth = () => useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 30_000 });
export const useOverview = () => useQuery({ queryKey: ["overview"], queryFn: api.overview, refetchInterval: 3000 });
export const useLinks = (history = 100) =>
  useQuery({ queryKey: ["links", history], queryFn: () => api.links(history), refetchInterval: 3000 });
export const useAudit = () => useQuery({ queryKey: ["audit"], queryFn: api.audit, refetchInterval: 5000 });
export const useAttacks = () => useQuery({ queryKey: ["attacks"], queryFn: api.attacks, staleTime: Infinity });
export const useVerdictSummaries = (limit = 100) =>
  useQuery({ queryKey: ["verdicts", limit], queryFn: () => api.verdicts(limit), refetchInterval: 3000 });
export const useVerdict = (index: number | undefined) =>
  useQuery({ queryKey: ["verdict", index], queryFn: () => api.verdict(index as number), enabled: index !== undefined && !Number.isNaN(index) });
export const useLedger = (limit = 80) => useQuery({ queryKey: ["ledger", limit], queryFn: () => api.ledger(limit), refetchInterval: 3000 });
export const useFraudQueue = (minRisk = 25, openOnly = false) =>
  useQuery({ queryKey: ["fraud-queue", minRisk, openOnly], queryFn: () => api.fraudQueue(minRisk, openOnly), refetchInterval: 6000, retry: false });
export const useCopilotStatus = () => useQuery({ queryKey: ["copilot-status"], queryFn: api.copilotStatus, retry: false, staleTime: 60_000 });

/** Key IDs the ledger auditor flagged as transferability disputes (for the §8 chip rule 1). */
export function useDisputedKeys(): Set<string> {
  const audit = useAudit();
  return useMemo(() => new Set(audit.data?.disputes.map((d) => d.key_id) ?? []), [audit.data]);
}
