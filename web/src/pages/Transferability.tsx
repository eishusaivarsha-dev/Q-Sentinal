// Transferability Arena (docs/frontend-spec.md §4.7): a cheating signer vs commit-reveal shuffle.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { api } from "@/api/client";
import { pct } from "@/lib/format";
import { useSession } from "@/state/session";
import { AttackGlyph } from "@/components/art/AttackGlyph";
import { Toggle } from "@/components/art/Instruments";
import SeriesChart from "@/components/channel/SeriesChart";
import { Chip, DecisionBadge, Empty, ErrorNote, PageHeader, Panel, Slider } from "@/components/shell/primitives";

/** Illustrative key grid: which of a verifier's key positions are damaged (display only). */
function Grid({ damage, seed }: { damage: number; seed: number }) {
  const cells = useMemo(() => {
    let x = seed * 9301 + 49297;
    return Array.from({ length: 60 }, () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280 < damage;
    });
  }, [damage, seed]);
  return (
    <div className="grid grid-cols-12 gap-1">
      {cells.map((bad, i) => (
        <motion.div key={i} layout className="aspect-square rounded-full border border-ink"
          animate={{ backgroundColor: bad ? "#c8502a" : "#5c7a34", boxShadow: bad ? "0 0 6px rgba(224,81,58,.7)" : "none" }} transition={{ duration: 0.7 }} />
      ))}
    </div>
  );
}

export default function Transferability() {
  const qc = useQueryClient();
  const replay = useSession((s) => s.replay);
  const [protect, setProtect] = useState(true);
  const [delta, setDelta] = useState(0.4);
  const run = useMutation({
    mutationFn: () => api.runAttack({ attack: protect ? "repudiation" : "repudiation_unprotected", strength: delta }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const evidence = useMutation({
    mutationFn: async () => {
      const [off, on] = await Promise.all([
        api.sweep({ attack: "repudiation_unprotected", min: 0.1, max: 0.4, steps: 4, trials: 5 }),
        api.sweep({ attack: "repudiation", min: 0.1, max: 0.4, steps: 4, trials: 5 }),
      ]);
      return off.map((r, i) => ({ i: pct(r.strength, 0), without: Number(r.AUDIT_rate), with: 1 - on[i].pass_rate }));
    },
  });
  const m = run.data?.metrics;
  const shownProtect = m ? Boolean(m.symmetrised) : protect;

  return (
    <div>
      <PageHeader directive="Directive 07 · Arena" title="Transferability"
        lede="A cheating Alice sends Bob good coins and Charlie damaged ones, so Bob accepts, Charlie rejects, and she can deny she signed. The blockchain's commit-reveal shuffle stops her." />
      <Panel className="mb-5" title="Set up the attack" code="POST /attacks/run">
        <div className="grid items-center gap-5 md:grid-cols-[auto_1fr_auto]">
          <div className="flex items-center gap-3">
            <AttackGlyph glyph="mask" size={52} hot={!protect} />
            <Toggle on={protect} onChange={setProtect} label="Commit-reveal shuffle" />
          </div>
          <Slider label="Share of Charlie's copy Alice damages (δ)" value={delta} onChange={setDelta} min={0.05} max={0.5} format={(v) => pct(v, 0)} />
          <button className="btn-danger" disabled={run.isPending || replay} onClick={() => run.mutate()}>{run.isPending ? "Running…" : "Let Alice cheat"}</button>
        </div>
        {run.error && <div className="mt-3"><ErrorNote error={run.error} /></div>}
      </Panel>
      <div className="mb-5 grid gap-5 md:grid-cols-2">
        {(["bob", "charlie"] as const).map((who, k) => (
          <Panel key={who} title={who === "bob" ? "Bob · direct recipient" : "Charlie · forwarded copy"} code={who === "bob" ? "strict τ = 0.10" : "lenient τ = 0.14"}
            actions={m && <DecisionBadge decision={m[who]} />}>
            <Grid damage={shownProtect ? delta / 2 : who === "bob" ? 0 : delta} seed={k + 1} />
            <p className="mt-3 text-[11.5px] text-paper-faint">{shownProtect ? "After the shuffle, the damage is spread evenly across both copies." : who === "bob" ? "Alice gave Bob a perfect copy." : "Alice damaged Charlie's copy."}</p>
          </Panel>
        ))}
      </div>
      {m && (
        <Panel className="mb-5" title="Outcome" code={run.data?.attack}>
          <p className="font-display text-[26px] leading-snug">
            {m.violation ? <span className="text-reject">Alice split the verifiers — Bob ACCEPT, Charlie REJECT.</span> : <span className="text-accept">Transferability holds — Alice could not split the verifiers.</span>}
          </p>
          <p className="mt-2 text-[12.5px] text-paper-dim">{run.data?.detail}</p>
          {m.disputes > 0 && <Chip tone="bad" className="mt-3">Ledger audit flagged a dispute</Chip>}
        </Panel>
      )}
      <Panel title="Evidence: how often can Alice split the verifiers?" code="POST /sweeps ×2"
        actions={<button className="btn-ghost !py-1.5" disabled={evidence.isPending || replay} onClick={() => evidence.mutate()}>{evidence.isPending ? "Sweeping…" : "Run evidence sweep"}</button>}>
        {evidence.error && <ErrorNote error={evidence.error} />}
        {evidence.data ? (
          <SeriesChart data={evidence.data} domain={[0, 1]} lines={[{ key: "without", name: "without shuffle", color: "#e0513a" }, { key: "with", name: "with shuffle", color: "#7fb8a4" }]} />
        ) : <Empty>Full-size backend result: 100% of trials split without the shuffle at δ ≥ 20% (all flagged by the audit); 0% with it.</Empty>}
      </Panel>
    </div>
  );
}
