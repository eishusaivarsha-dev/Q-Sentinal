// Ledger Explorer (docs/frontend-spec.md §4.6): the chain, Merkle anchors, and the auditor.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api, API_URL } from "@/api/client";
import { useAudit } from "@/api/hooks";
import type { LedgerEntry } from "@/api/types";
import { shortHash, stamp } from "@/lib/format";
import { useSession } from "@/state/session";
import { Chip, Empty, ErrorNote, LinkText, PageHeader, Panel } from "@/components/shell/primitives";
import { MerkleLadder } from "@/components/verdict/VerdictParts";

const KIND: Record<string, { border: string; bg: string; label: string }> = {
  verdict: { border: "#a9c46c", bg: "rgba(169,196,108,.08)", label: "verdict" },
  merkle_anchor: { border: "#f3c877", bg: "rgba(243,200,119,.14)", label: "Merkle anchor" },
  link_commissioned: { border: "#38bdf8", bg: "rgba(56,189,248,.08)", label: "link baseline" },
  sym_commit: { border: "#a78bfa", bg: "rgba(167,139,250,.1)", label: "sym commit" },
  sym_reveal: { border: "#a78bfa", bg: "transparent", label: "sym reveal" },
};

function Block({ e, selected, onClick }: { e: LedgerEntry; selected: boolean; onClick: () => void }) {
  const reject = e.kind === "verdict" && e.payload.decision === "REJECT";
  const k = KIND[e.kind] ?? { border: "#5f5442", bg: "transparent", label: e.kind };
  return (
    <button onClick={onClick}
      className={`relative w-44 shrink-0 rounded-md border-2 p-2.5 text-left text-[11px] transition ${selected ? "shadow-glow" : "hover:-translate-y-0.5"}`}
      style={{ borderColor: reject ? "#e0513a" : k.border, background: reject ? "rgba(224,81,58,.12)" : k.bg, borderStyle: e.kind === "sym_reveal" ? "dashed" : "solid" }}>
      <p className="font-label uppercase tracking-[.12em] text-paper">#{e.index} · {k.label}</p>
      {e.kind === "verdict" && <p className={reject ? "text-reject" : "text-accept"}>{String(e.payload.decision)}</p>}
      <p className="data mt-1 text-paper-mute">prev {e.prev_hash.slice(0, 8)}…</p>
      <p className="data text-paper-dim">hash {e.entry_hash.slice(0, 8)}…</p>
      <span className="absolute -right-3 top-1/2 text-amber/60">→</span>
    </button>
  );
}

export default function LedgerExplorer() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => api.ledger(80), refetchInterval: 3000 });
  const audit = useAudit();
  const verify = useMutation({ mutationFn: api.ledgerVerify });
  const anchor = useMutation({ mutationFn: api.anchor, onSuccess: () => qc.invalidateQueries() });
  const [sel, setSel] = useState<LedgerEntry | null>(null);
  const [proofIdx, setProofIdx] = useState<number | null>(null);
  const proof = useQuery({ queryKey: ["proof", proofIdx], queryFn: () => api.proof(proofIdx as number), enabled: proofIdx !== null, retry: false });
  const a = audit.data;

  return (
    <div>
      <PageHeader directive="Directive 06 · Archive" title="Ledger Explorer"
        lede="A diary nobody can edit: each entry holds the previous entry's hash and an ML-DSA-65 signature. Every 8 verdicts get one Merkle root. Don't trust the server — recompute the proof in your own browser." />
      {ledger.error && <div className="mb-5"><ErrorNote error={ledger.error} /></div>}
      <Panel className="mb-5" title="Chain" code="latest 80 entries"
        actions={
          <>
            {verify.data && <Chip tone={verify.data.ok ? "ok" : "bad"}>{verify.data.detail}</Chip>}
            <button className="btn-ghost !py-1.5" onClick={() => verify.mutate()} disabled={verify.isPending}>Verify whole chain</button>
            <button className="btn-ghost !py-1.5" onClick={() => anchor.mutate()} disabled={anchor.isPending || replay}>Anchor pending</button>
          </>
        }>
        {anchor.error && <div className="mb-3"><ErrorNote error={anchor.error} /></div>}
        {ledger.data?.length ? (
          <div className="flex gap-4 overflow-x-auto pb-3">
            {ledger.data.map((e) => <Block key={e.index} e={e} selected={sel?.index === e.index} onClick={() => { setSel(e); setProofIdx(null); }} />)}
          </div>
        ) : <Empty>The ledger is empty.</Empty>}
        <p className="mt-2 font-type text-[11px] text-paper-faint">Olive / red = verdicts · gold = Merkle anchor · sky = link baseline · violet = symmetrisation commit (dashed = reveal).</p>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={sel ? `Entry #${sel.index} · ${sel.kind}` : "Entry details"} code={sel ? stamp(sel.timestamp) : ""}>
          {sel ? (
            <div className="space-y-2 text-[11.5px]">
              <p className="data break-all text-paper">entry hash {sel.entry_hash}</p>
              <p className="data break-all text-paper-faint">prev hash {sel.prev_hash}</p>
              <p className="data break-all text-paper-mute">ML-DSA-65 signature {sel.signature.slice(0, 96)}… ({sel.signature.length / 2} bytes)</p>
              <pre className="data max-h-64 overflow-auto rounded-md border hair bg-ink/60 p-2 text-[11px] text-paper-dim">{JSON.stringify(sel.payload, null, 2)}</pre>
              {sel.kind === "verdict" && (
                <div className="flex flex-wrap gap-4">
                  <Link to={`/verdicts/${sel.index}`}><LinkText>Open certificate →</LinkText></Link>
                  <button onClick={() => setProofIdx(sel.index)}><LinkText>Show Merkle proof</LinkText></button>
                </div>
              )}
              {sel.kind === "merkle_anchor" && (
                <p className="text-paper-dim">Root <span className="data text-amber">{shortHash(String(sel.payload.root), 12)}</span> covers verdicts {(sel.payload.members as number[]).join(", ")}.</p>
              )}
            </div>
          ) : <Empty>Click a block on the chain.</Empty>}
          {proofIdx !== null && (
            <div className="mt-4 border-t hair pt-4">
              <h3 className="panel-title mb-3">Merkle proof for #{proofIdx}</h3>
              {proof.error ? <ErrorNote error={proof.error} hint="Not anchored yet? Press “Anchor pending”." /> : proof.data ? (
                <div className="space-y-4">
                  <MerkleLadder proof={proof.data} serverValid={proof.data.valid} />
                  <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                    <div className="rounded-sm border-2 border-ink p-2 shadow-[4px_4px_0_#0c0a07]" style={{ background: "#e9dcc0" }}>
                      <QRCodeSVG value={`${API_URL}/ledger/proof/${proofIdx}`} size={104} bgColor="#e9dcc0" fgColor="#0c0a07" />
                    </div>
                    <p className="text-[11.5px] text-paper-faint">Scan to fetch this public proof on a phone. It carries only the ledger index — no credentials.</p>
                  </div>
                </div>
              ) : <Empty>Fetching proof…</Empty>}
            </div>
          )}
        </Panel>
        <Panel title="Auditor" code="GET /ledger/audit" actions={a && <Chip tone={a.ok ? "ok" : "bad"}>{a.ok ? "all checks pass" : "problems found"}</Chip>}>
          {audit.error && <ErrorNote error={audit.error} />}
          {a && (
            <div className="space-y-3 text-[12.5px] text-paper-dim">
              <p>Chain: {a.chain_ok ? "✓" : "✗"} {a.chain_detail}</p>
              <p>Merkle anchors: {a.anchor_problems.length ? a.anchor_problems.join("; ") : "all roots recompute ✓"}</p>
              <p>Symmetrisation: {a.symmetrisation.committed} committed · {a.symmetrisation.revealed} revealed{a.symmetrisation.problems.length ? ` · ${a.symmetrisation.problems.join("; ")}` : " · all reveals match ✓"}</p>
              <div>
                <h3 className="panel-title mb-2">Disputes (transferability violations)</h3>
                {a.disputes.length ? a.disputes.map((d) => (
                  <div key={d.key_id + d.nonce} className="mt-2 rounded-md border border-reject/60 bg-reject/10 p-3 text-[11.5px]">
                    <p className="font-label uppercase tracking-[.12em] text-reject">{d.finding}</p>
                    <p className="mt-1 text-paper">{Object.entries(d.verdicts).map(([who, x]) => `${who}: ${x.decision}${x.transferred ? " (forwarded)" : " (direct)"}`).join(" · ")}</p>
                    <p className="data text-paper-faint">key {d.key_id}</p>
                  </div>
                )) : <p className="text-accept">None.</p>}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
