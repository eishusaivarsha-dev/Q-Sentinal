import type { TelemetryEvent } from "../api";

export default function AlertFeed({ verdicts }: { verdicts: TelemetryEvent[] }) {
  const rows = [...verdicts].reverse().slice(0, 30);
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-2 font-medium">Alert feed</h2>
      {rows.length === 0 && <p className="text-sm text-slate-500">No verifications yet.</p>}
      <ul className="space-y-1 text-sm">
        {rows.map((e) => (
          <li key={e.seq} className="flex flex-wrap gap-x-3">
            <span className="font-mono text-slate-500">#{e.seq}</span>
            <span className={e.data.decision === "ACCEPT" ? "text-emerald-400" : "text-rose-400"}>
              {e.data.decision}
            </span>
            <span className="text-slate-300">
              {e.data.alerts?.length
                ? e.data.alerts.map((a) => `${a.detector}: ${a.detail}`).join(" | ")
                : "no alerts"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
