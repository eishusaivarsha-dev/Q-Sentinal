// Transferability Arena (docs/frontend-spec.md §4.7): a cheating signer vs the commit-reveal
// shuffle. Alice sends Bob good coins and Charlie damaged ones so Bob accepts, Charlie rejects,
// and she can deny she signed. The ledger's shuffle makes that impossible.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FlaskConical, Scale, Swords, VenetianMask } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { pct } from "@/lib/format";
import { useSession } from "@/state/session";
import SeriesChart from "@/components/charts";
import { to } from "@/components/shell/nav";
import { AttackIcon, Card, Chip, DecisionBadge, Empty, ErrorNote, PageHeader, Slider, Toggle } from "@/components/ui";

/** Illustrative key grid: which of a verifier's key positions are damaged (display only). */
function Grid({ damage, seed }: { damage: number; seed: number }) {
  const cells = useMemo(() => {
    let x = seed * 9301 + 49297;
    return Array.from({ length: 72 }, () => {
      x = (x * 9301 + 49297) % 233280;
      return x / 233280 < damage;
    });
  }, [damage, seed]);
  return (
    <div className="grid grid-cols-12 gap-1.5">
      {cells.map((bad, i) => (
        <motion.div key={i} className="aspect-square rounded-full"
          animate={{ backgroundColor: bad ? "rgb(var(--bad))" : "rgb(var(--ok) / .55)", scale: bad ? 1.08 : 1, boxShadow: bad ? "0 0 10px rgb(var(--bad) / .6)" : "none" }}
          transition={{ duration: 0.6, delay: (i % 12) * 0.01 }} />
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
      return off.map((r, i) => ({ i: pct(r.strength, 0), without: Number(r.AUDIT_rate ?? 1 - r.pass_rate), with: 1 - on[i].pass_rate }));
    },
  });
  const m = run.data?.metrics;
  const shownProtect = m ? Boolean(m.symmetrised) : protect;

  return (
    <div>
      <PageHeader eyebrow="Prove · non-repudiation" title="Transferability" accent="arena"
        lede="A cheating Alice sends Bob good coins and Charlie damaged ones, so Bob accepts, Charlie rejects, and she can later deny she signed. The ledger's commit-reveal shuffle stops her." />
      <Card glow title="Set up the attack" sub="POST /attacks/run" icon={Swords} className="mb-6">
        <div className="grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
          <div className="flex items-center gap-4">
            <AttackIcon glyph="mask" size={56} tone={protect ? "ok" : "bad"} />
            <Toggle on={protect} onChange={setProtect} label="Commit-reveal shuffle" sub={protect ? "verifiers shuffle key copies" : "unprotected"} />
          </div>
          <Slider label="Share of Charlie's copy Alice damages (δ)" value={delta} onChange={setDelta} min={0.05} max={0.5} format={(v) => pct(v, 0)} />
          <button className="btn-danger" disabled={run.isPending || replay} onClick={() => run.mutate()}><VenetianMask size={17} />{run.isPending ? "Running…" : "Let Alice cheat"}</button>
        </div>
        {run.error && <div className="mt-4"><ErrorNote error={run.error} /></div>}
      </Card>

      <div className="mb-6 grid gap-6 md:grid-cols-2">
        {(["bob", "charlie"] as const).map((who, k) => (
          <Card key={who} title={who === "bob" ? "Bob · direct recipient" : "Charlie · forwarded copy"} sub={who === "bob" ? "strict τ = 0.10" : "lenient τ = 0.14"}
            actions={m && <DecisionBadge decision={m[who]} />}>
            <Grid damage={shownProtect ? delta / 2 : who === "bob" ? 0 : delta} seed={k + 1} />
            <p className="mt-4 text-[14px] text-ink-3">{shownProtect ? "After the shuffle the damage is spread evenly over both copies, so both verifiers reach the same decision." : who === "bob" ? "Alice gave Bob a perfect copy." : "Alice damaged Charlie's copy."}</p>
          </Card>
        ))}
      </div>

      {m && (
        <Card title="Outcome" sub={run.data?.attack} icon={Scale} className="mb-6">
          <p className="text-[26px] font-extrabold leading-snug">
            {m.violation ? <span className="text-bad">Alice split the verifiers: Bob ACCEPT, Charlie REJECT.</span> : <span className="text-ok">Transferability holds: Alice could not split the verifiers.</span>}
          </p>
          <p className="mt-2 text-[15px] text-ink-2">{run.data?.detail}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {m.disputes > 0 && <Chip tone="bad">Ledger audit flagged a dispute</Chip>}
            {m.disputes > 0 && <Link className="btn-soft btn-sm" to={to("fraud")}>The AI queued it for fraud review →</Link>}
          </div>
        </Card>
      )}

      <Card title="Evidence: how often can Alice split the verifiers?" sub="POST /sweeps × 2 · throw-away system" icon={FlaskConical}
        actions={<button className="btn-ghost btn-sm" disabled={evidence.isPending || replay} onClick={() => evidence.mutate()}>{evidence.isPending ? "Sweeping…" : "Run evidence sweep"}</button>}>
        {evidence.error && <ErrorNote error={evidence.error} />}
        {evidence.data ? (
          <SeriesChart data={evidence.data} domain={[0, 1]} area lines={[{ key: "without", name: "without shuffle", token: "bad" }, { key: "with", name: "with shuffle", token: "ok" }]} />
        ) : <Empty>Full-size backend result: 100% of trials split without the shuffle at δ ≥ 20% (all flagged by the audit); 0% with it.</Empty>}
      </Card>
    </div>
  );
}
