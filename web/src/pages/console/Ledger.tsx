// Ledger Explorer (docs/frontend-spec.md §4.6): the hash chain in 3-D, every entry's payload and
// ML-DSA signature, Merkle anchors, analyst reviews, and the auditor that anyone can re-run.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Anchor, Blocks, FileSearch, Gavel, ShieldCheck, ShieldX } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { useAudit } from "@/api/hooks";
import type { LedgerEntry } from "@/api/types";
import { cn } from "@/lib/cn";
import { shortHash, stamp } from "@/lib/format";
import { useSession } from "@/state/session";
import { to } from "@/components/shell/nav";
import { Card, Chip, DecisionBadge, Empty, ErrorNote, KeyVal, PageHeader, Skeleton, Tabs, type Tone } from "@/components/ui";

const LedgerChain = lazy(() => import("@/three/LedgerChain"));

type Kind = "all" | "verdict" | "merkle_anchor" | "analyst_review" | "link_commissioned";
const KIND_TONE: Record<string, Tone> = { verdict: "ok", merkle_anchor: "warn", analyst_review: "brand", link_commissioned: "info" };

function EntryDetail({ e }: { e: LedgerEntry }) {
  const p = e.payload;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={KIND_TONE[e.kind] ?? "neutral"}>{e.kind.replaceAll("_", " ")}</Chip>
        <Chip tone="neutral" className="data">#{e.index}</Chip>
        {e.kind === "verdict" && <DecisionBadge decision={p.decision} />}
        {e.kind === "analyst_review" && <Chip tone={p.decision === "confirm_fraud" ? "bad" : p.decision === "dismiss" ? "ok" : "warn"}>{String(p.decision).replace("_", " ")} · by {p.reviewer}</Chip>}
        <span className="text-[13px] text-ink-3">{stamp(e.timestamp)}</span>
      </div>
      <KeyVal cols={2} items={[["Entry hash", shortHash(e.entry_hash, 10)], ["Previous", shortHash(e.prev_hash, 10)], ["Payload hash", shortHash(e.payload_hash, 10)], ["ML-DSA signature", `${(e.signature.length / 2).toLocaleString()} bytes`]]} />
      {e.kind === "verdict" && <Link className="link text-[15px]" to={to(`verdicts/${e.index}`)}>Open proof certificate →</Link>}
      {e.kind === "analyst_review" && <Link className="link text-[15px]" to={to(`fraud/${p.verdict_index}`)}>Open fraud case #{p.verdict_index} →</Link>}
      <pre className="data max-h-[280px] overflow-auto rounded-2xl border border-line bg-surface-2 p-4 text-[12px] leading-relaxed text-ink-2" data-lenis-prevent>{JSON.stringify(p, null, 2)}</pre>
    </div>
  );
}

function Auditor() {
  const audit = useAudit();
  const a = audit.data;
  if (audit.error) return <ErrorNote error={audit.error} />;
  if (!a) return <Skeleton className="h-48" />;
  return (
    <div className="space-y-4">
      <div className={cn("flex items-center gap-3 rounded-2xl border p-4", a.ok ? "border-ok/30 bg-ok/8" : "border-bad/30 bg-bad/8")}>
        {a.ok ? <ShieldCheck className="text-ok" /> : <ShieldX className="text-bad" />}
        <div>
          <div className={cn("text-[17px] font-bold", a.ok ? "text-ok" : "text-bad")}>{a.ok ? "Ledger audit passed" : "Ledger audit found problems"}</div>
          <div className="text-[14px] text-ink-2">{a.chain_detail}</div>
        </div>
      </div>
      <KeyVal cols={3} items={[
        ["Anchor problems", a.anchor_problems.length], ["Commitments", `${a.symmetrisation.committed} committed · ${a.symmetrisation.revealed} revealed`],
        ["Disputes", a.disputes.length],
      ]} />
      {a.disputes.map((d) => (
        <div key={d.key_id + d.nonce} className="rounded-2xl border border-bad/30 bg-bad/8 p-4 text-[14px]">
          <div className="font-bold text-bad">Transferability dispute · key {shortHash(d.key_id, 6)}</div>
          <div className="mt-1 text-ink-2">{d.finding}</div>
          <div className="mt-2 flex flex-wrap gap-2">{Object.entries(d.verdicts).map(([v, x]) => <Chip key={v} tone={x.decision === "ACCEPT" ? "ok" : "bad"}>{v}: {x.decision}{x.transferred ? " (fwd)" : ""}</Chip>)}</div>
        </div>
      ))}
      {[...a.anchor_problems, ...a.symmetrisation.problems].map((p) => <p key={p} className="text-[14px] text-bad">{p}</p>)}
    </div>
  );
}

export default function Ledger() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const [kind, setKind] = useState<Kind>("all");
  const [sel, setSel] = useState<number | null>(null);
  const ledger = useQuery({ queryKey: ["ledger", 60, kind], queryFn: () => api.ledger(60, kind === "all" ? undefined : kind), refetchInterval: 4000 });
  const verify = useMutation({ mutationFn: api.ledgerVerify });
  const anchor = useMutation({ mutationFn: api.anchor, onSuccess: () => qc.invalidateQueries() });
  const entries = ledger.data ?? [];
  const selected = entries.find((e) => e.index === sel) ?? entries[entries.length - 1];

  return (
    <div>
      <PageHeader eyebrow="Observe · blockchain" title="The" accent="Ledger"
        lede="Every verdict and every analyst decision is hash-chained, signed with post-quantum ML-DSA-65 and anchored under a Merkle root. Change one byte anywhere and the chain breaks."
        right={
          <>
            <button className="btn-ghost" disabled={verify.isPending} onClick={() => verify.mutate()}><ShieldCheck size={16} />{verify.isPending ? "Verifying…" : "Verify chain"}</button>
            <button className="btn-primary" disabled={anchor.isPending || replay} onClick={() => anchor.mutate()}><Anchor size={16} />{anchor.isPending ? "Anchoring…" : "Anchor now"}</button>
          </>
        } />
      {verify.data && (
        <div className={cn("mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-[15px] font-semibold", verify.data.ok ? "border-ok/30 bg-ok/8 text-ok" : "border-bad/30 bg-bad/8 text-bad")}>
          {verify.data.ok ? <ShieldCheck size={18} /> : <ShieldX size={18} />}{verify.data.detail}
        </div>
      )}
      {(verify.error || anchor.error) && <div className="mb-6"><ErrorNote error={verify.error ?? anchor.error} /></div>}

      <section className="card relative mb-6 overflow-hidden">
        <div className="absolute left-5 top-5 z-10 flex flex-wrap items-center gap-2">
          <Tabs value={kind} onChange={(k) => { setKind(k); setSel(null); }} options={[["all", "All"], ["verdict", "Verdicts"], ["merkle_anchor", "Anchors"], ["analyst_review", "Reviews"]]} />
        </div>
        <div className="absolute bottom-4 left-5 z-10 flex flex-wrap gap-2 text-[12.5px]">
          {[["verdict accept", "bg-ok"], ["verdict reject", "bg-bad"], ["Merkle anchor", "bg-warn"], ["analyst review", "bg-brand"], ["link baseline", "bg-brand-2"], ["commit / other", "bg-violet"]].map(([l, c]) => (
            <span key={l} className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-ink-2"><span className={cn("h-2 w-2 rounded-sm", c)} />{l}</span>
          ))}
        </div>
        {ledger.error ? <div className="p-6 pt-20"><ErrorNote error={ledger.error} /></div> : entries.length ? (
          <Suspense fallback={<Skeleton className="h-[380px] rounded-none" />}>
            <LedgerChain entries={entries.slice(-24)} selected={selected?.index ?? null} onSelect={(e) => setSel(e.index)} height={380} />
          </Suspense>
        ) : ledger.isLoading ? <Skeleton className="h-[380px] rounded-none" /> : <div className="p-6 pt-20"><Empty icon={Blocks}>No entries of this kind yet.</Empty></div>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card title="Entries" sub={`GET /ledger · newest ${entries.length}`} icon={Blocks} bodyClass="!pt-3">
          <div className="-mr-2 max-h-[560px] space-y-1.5 overflow-y-auto pr-2" data-lenis-prevent>
            {[...entries].reverse().map((e) => (
              <button key={e.index} onClick={() => setSel(e.index)}
                className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors", selected?.index === e.index ? "border-brand/50 bg-brand/8" : "border-transparent hover:bg-surface-2")}>
                <span className="data w-12 text-[13px] text-ink-3">#{e.index}</span>
                <Chip tone={KIND_TONE[e.kind] ?? "neutral"} className="!text-[11.5px]">{e.kind.replaceAll("_", " ")}</Chip>
                <span className="data min-w-0 flex-1 truncate text-[12.5px] text-ink-3">{shortHash(e.entry_hash, 10)}</span>
                {e.kind === "verdict" && <DecisionBadge decision={e.payload.decision} />}
                {e.kind === "analyst_review" && <Gavel size={15} className="text-brand" />}
              </button>
            ))}
          </div>
        </Card>
        <div className="min-w-0 space-y-6">
          <Card title="Entry" sub={selected ? `#${selected.index}` : "select a block"} icon={FileSearch}>{selected ? <EntryDetail e={selected} /> : <Empty>Select a block.</Empty>}</Card>
          <Card title="Auditor" sub="GET /ledger/audit · anyone can re-run it" icon={ShieldCheck}><Auditor /></Card>
        </div>
      </div>
    </div>
  );
}
