// Ledger Explorer (docs/frontend-spec.md §4.6): the chain, Merkle anchors, and the auditor.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, errorText } from "../api/client";
import type { LedgerEntry } from "../api/types";
import { MerkleLadder } from "../components/VerdictParts";
import { Button, Card, Empty, ErrorNote, Pill } from "../components/ui";
import { useSession } from "../state/session";

const KIND_STYLE: Record<string, string> = {
  verdict: "border-emerald-600",
  merkle_anchor: "border-amber-400 bg-amber-950/30",
  link_commissioned: "border-sky-500 bg-sky-950/30",
  sym_commit: "border-violet-500 bg-violet-950/30",
  sym_reveal: "border-violet-500 border-dashed",
};

function Block({ e, selected, onClick }: { e: LedgerEntry; selected: boolean; onClick: () => void }) {
  const reject = e.kind === "verdict" && e.payload.decision === "REJECT";
  return (
    <button onClick={onClick} className={`w-44 shrink-0 rounded-lg border-2 p-2 text-left text-xs ${reject ? "border-rose-600" : KIND_STYLE[e.kind] ?? "border-slate-600"} ${selected ? "ring-2 ring-cyan-400" : ""}`}>
      <p className="font-semibold">#{e.index} {e.kind.replace("_", " ")}</p>
      {e.kind === "verdict" && <p className={reject ? "text-rose-300" : "text-emerald-300"}>{e.payload.decision}</p>}
      <p className="mt-1 font-mono text-slate-400">prev {e.prev_hash.slice(0, 8)}…</p>
      <p className="font-mono text-slate-200">hash {e.entry_hash.slice(0, 8)}…</p>
    </button>
  );
}

export default function LedgerExplorer() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => api.ledger(80), refetchInterval: 3000 });
  const audit = useQuery({ queryKey: ["audit"], queryFn: api.audit, refetchInterval: 5000 });
  const verify = useMutation({ mutationFn: api.ledgerVerify });
  const anchor = useMutation({ mutationFn: api.anchor, onSuccess: () => qc.invalidateQueries() });
  const [sel, setSel] = useState<LedgerEntry | null>(null);
  const [proofIdx, setProofIdx] = useState<number | null>(null);
  const proof = useQuery({ queryKey: ["proof", proofIdx], queryFn: () => api.proof(proofIdx as number), enabled: proofIdx !== null, retry: false });
  const a = audit.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Ledger Explorer</h1>
        <p className="text-sm text-slate-400">A diary nobody can edit: each entry holds the previous entry's hash and an ML-DSA-65 signature. Every 8 verdicts get one Merkle root.</p>
      </div>
      {ledger.error && <ErrorNote error={ledger.error} />}
      <Card title="Chain (latest 80 entries)" right={
        <div className="flex flex-wrap items-center gap-2">
          {verify.data && <Pill tone={verify.data.ok ? "ok" : "bad"}>{verify.data.detail}</Pill>}
          <Button variant="ghost" onClick={() => verify.mutate()} disabled={verify.isPending}>Verify whole chain</Button>
          <Button variant="ghost" onClick={() => anchor.mutate()} disabled={anchor.isPending || replay}>Anchor pending verdicts</Button>
        </div>}>
        {anchor.error && <p className="mb-2 text-sm text-rose-300">{errorText(anchor.error)}</p>}
        {ledger.data?.length ? (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {ledger.data.map((e) => <Block key={e.index} e={e} selected={sel?.index === e.index} onClick={() => setSel(e)} />)}
          </div>
        ) : <Empty>The ledger is empty.</Empty>}
        <p className="mt-2 text-xs text-slate-500">Colours: green/red = verdicts · gold = Merkle anchor · blue = link baseline · violet = symmetrisation commit / reveal.</p>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={sel ? `Entry #${sel.index}: ${sel.kind}` : "Entry details"}>
          {sel ? (
            <div className="space-y-2 text-xs">
              <p className="break-all font-mono">entry hash {sel.entry_hash}</p>
              <p className="break-all font-mono text-slate-400">prev hash {sel.prev_hash}</p>
              <p className="break-all font-mono text-slate-500">ML-DSA-65 signature {sel.signature.slice(0, 96)}… ({sel.signature.length / 2} bytes)</p>
              <pre className="max-h-64 overflow-auto rounded bg-slate-950 p-2">{JSON.stringify(sel.payload, null, 2)}</pre>
              {sel.kind === "verdict" && (
                <div className="flex gap-3">
                  <Link className="text-cyan-300 underline" to={`/verdicts/${sel.index}`}>Open certificate →</Link>
                  <button className="text-cyan-300 underline" onClick={() => setProofIdx(sel.index)}>Show Merkle proof</button>
                </div>
              )}
              {sel.kind === "merkle_anchor" && (
                <p>Root <span className="font-mono">{sel.payload.root}</span> covers verdicts {(sel.payload.members as number[]).join(", ")}.</p>
              )}
            </div>
          ) : <Empty>Click a block.</Empty>}
          {proofIdx !== null && (
            <div className="mt-3 border-t border-slate-800 pt-3">
              <h3 className="mb-2 text-sm font-semibold">Merkle proof for #{proofIdx}</h3>
              {proof.error ? <p className="text-sm text-amber-300">{errorText(proof.error)}</p> : proof.data ? <MerkleLadder proof={proof.data} /> : <p className="text-sm">loading…</p>}
            </div>
          )}
        </Card>
        <Card title="Auditor" right={a && <Pill tone={a.ok ? "ok" : "bad"}>{a.ok ? "all checks pass" : "problems found"}</Pill>}>
          {audit.error && <ErrorNote error={audit.error} />}
          {a && (
            <div className="space-y-3 text-sm">
              <p>Chain: {a.chain_ok ? "✓" : "✗"} {a.chain_detail}</p>
              <p>Merkle anchors: {a.anchor_problems.length ? a.anchor_problems.join("; ") : "all roots recompute ✓"}</p>
              <p>Symmetrisation: {a.symmetrisation.committed} committed · {a.symmetrisation.revealed} revealed{a.symmetrisation.problems.length ? ` · ${a.symmetrisation.problems.join("; ")}` : " · all reveals match ✓"}</p>
              <div>
                <h3 className="font-semibold">Disputes (transferability violations)</h3>
                {a.disputes.length ? a.disputes.map((d) => (
                  <div key={d.key_id + d.nonce} className="mt-2 rounded-lg border border-rose-700 bg-rose-950/40 p-2 text-xs">
                    <p className="font-semibold text-rose-200">{d.finding}</p>
                    <p className="mt-1">{Object.entries(d.verdicts).map(([who, x]) => `${who}: ${x.decision}${x.transferred ? " (forwarded)" : " (direct)"}`).join(" · ")}</p>
                    <p className="font-mono text-slate-400">key {d.key_id}</p>
                  </div>
                )) : <p className="text-emerald-300">None.</p>}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
