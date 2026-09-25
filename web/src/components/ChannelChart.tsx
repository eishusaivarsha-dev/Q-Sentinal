import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TelemetryEvent } from "../api";

// QBER (left axis) and CHSH S (right axis) per verification.
export default function ChannelChart({ verdicts }: { verdicts: TelemetryEvent[] }) {
  const data = verdicts.map((e) => ({
    seq: e.seq,
    qber: e.data.qber ?? 0,
    chsh: e.data.chsh ?? null,
  }));
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <h2 className="mb-2 font-medium">Channel health</h2>
      <div className="h-64">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid stroke="#1e293b" />
            <XAxis dataKey="seq" stroke="#64748b" />
            <YAxis yAxisId="q" domain={[0, 0.6]} stroke="#64748b" />
            <YAxis yAxisId="s" orientation="right" domain={[0, 3]} stroke="#64748b" />
            <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
            <Legend />
            <ReferenceLine yAxisId="q" y={0.11} stroke="#f59e0b" strokeDasharray="4 4" label="QBER max" />
            <ReferenceLine yAxisId="s" y={2} stroke="#f43f5e" strokeDasharray="4 4" label="CHSH = 2" />
            <Line yAxisId="q" type="monotone" dataKey="qber" name="QBER" stroke="#38bdf8" dot={false} />
            <Line yAxisId="s" type="monotone" dataKey="chsh" name="CHSH S" stroke="#a78bfa" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
