// Transferability Arena (docs/frontend-spec.md §4.7): a cheating signer vs commit-reveal shuffle.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, errorText } from "../api/client";
import SeriesChart from "../components/SeriesChart";
import { Button, Card, DecisionPill, Pill, Slider } from "../components/ui";
import { pct } from "../lib/physics";
import { useSession } from "../state/session";

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
      {cells.map((bad, i) => <div key={i} className={`aspect-square rounded-full transition-colors duration-700 ${bad ? "bg-orange-500" : "bg-teal-600"}`} />)}
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Transferability Arena</h1>
        <p className="text-sm text-slate-400">A cheating Alice sends Bob good coins and Charlie damaged ones, so Bob accepts, Charlie rejects, and she can deny she signed. The blockchain's commit-reveal shuffle stops her.</p>
      </div>
      <Card title="Set up the attack">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={protect} onChange={(e) => setProtect(e.target.checked)} className="h-5 w-5 accent-cyan-500" />
            Symmetrisation (commit-reveal shuffle) {protect ? "ON" : "OFF"}
          </label>
          <Slider label="Share of Charlie's copy Alice damages (δ)" value={delta} onChange={setDelta} min={0.05} max={0.5} format={(v) => pct(v, 0)} />
          <Button variant="danger" disabled={run.isPending || replay} onClick={() => run.mutate()}>{run.isPending ? "Running…" : "Let Alice cheat"}</Button>
        </div>
        {run.error && <p className="mt-2 text-sm text-rose-300">{errorText(run.error)}</p>}
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {(["bob", "charlie"] as const).map((who, k) => (
          <Card key={who} title={who === "bob" ? "Bob – direct recipient (strict τ = 0.10)" : "Charlie – forwarded copy (lenient τ = 0.14)"}
            right={m && <DecisionPill decision={m[who]} />}>
            <Grid damage={shownProtect ? delta / 2 : who === "bob" ? 0 : delta} seed={k + 1} />
            <p className="mt-2 text-xs text-slate-400">{shownProtect ? "After the shuffle, the damage is spread across both copies." : who === "bob" ? "Alice gave Bob a perfect copy." : "Alice damaged Charlie's copy."}</p>
          </Card>
        ))}
      </div>
      {m && (
        <Card title="Outcome">
          <p className="text-lg">
            {m.violation ? <span className="text-rose-300">Alice split the verifiers (Bob ACCEPT, Charlie REJECT).</span> : <span className="text-emerald-300">Transferability holds – Alice could not split the verifiers.</span>}
          </p>
          <p className="mt-1 text-sm text-slate-400">{run.data?.detail}</p>
          {m.disputes > 0 && <Pill tone="bad" className="mt-2">Ledger audit flagged a dispute</Pill>}
        </Card>
      )}
      <Card title="Evidence: how often can Alice split the verifiers?" right={<Button variant="ghost" disabled={evidence.isPending || replay} onClick={() => evidence.mutate()}>{evidence.isPending ? "Sweeping…" : "Run evidence sweep"}</Button>}>
        {evidence.error && <p className="text-sm text-rose-300">{errorText(evidence.error)}</p>}
        {evidence.data ? (
          <SeriesChart data={evidence.data} domain={[0, 1]} lines={[{ key: "without", name: "without shuffle", color: "#fb7185" }, { key: "with", name: "with shuffle", color: "#22d3ee" }]} />
        ) : <p className="text-sm text-slate-500">Full-size backend result: 100% of trials split without the shuffle at δ ≥ 20% (all flagged by the audit); 0% with it.</p>}
      </Card>
    </div>
  );
}
