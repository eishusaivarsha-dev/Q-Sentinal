import type { AttackRun } from "../api";

const sevColour = { info: "text-slate-400", warning: "text-amber-400", critical: "text-rose-400" };

export default function VerdictCard({ run }: { run: AttackRun }) {
  const v = run.verdict;
  const accepted = v.decision === "ACCEPT";
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-medium">
          {run.attack} <span className="text-slate-400">@ {(run.strength * 100).toFixed(0)}%</span>
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            accepted ? "bg-emerald-900 text-emerald-300" : "bg-rose-900 text-rose-300"
          }`}
        >
          {v.decision}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {v.results.map((r) => (
              <tr key={r.detector} className="border-t border-slate-800">
                <td className="py-1 pr-2 font-mono">{r.detector}</td>
                <td className="py-1 pr-2">{r.name}</td>
                <td className={`py-1 ${r.alert ? sevColour[r.severity] : "text-emerald-400"}`}>
                  {r.detail}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        Proof certificate: forgery bound per block{" "}
        {Number(v.certificate.forgery_bound_per_block).toExponential(2)} · transcript{" "}
        {String(v.certificate.transcript_hash).slice(0, 16)}… · ledger #
        {String(v.certificate.ledger_index)} · AI in trust path: no
      </p>
    </section>
  );
}
