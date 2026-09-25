import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface SeriesLine { key: string; name: string; color: string }
export interface RefLine { y: number; label: string; color: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SeriesChart({ data, lines, refs = [], height = 220, domain, xKey = "i" }: {
  data: Record<string, unknown>[]; lines: SeriesLine[]; refs?: RefLine[]; height?: number; domain?: [number, number]; xKey?: string;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="#1e293b" />
          <XAxis dataKey={xKey} stroke="#64748b" fontSize={12} />
          <YAxis stroke="#64748b" fontSize={12} domain={domain ?? ["auto", "auto"]} />
          <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155" }} />
          {lines.length > 1 && <Legend />}
          {refs.map((r) => (
            <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="4 4" label={{ value: r.label, fill: r.color, fontSize: 11, position: "insideTopRight" }} />
          ))}
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, color = "#38bdf8", threshold, height = 40 }: { values: number[]; color?: string; threshold?: number; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={[0, Math.max(threshold ?? 0, ...values, 0.02) * 1.15]} />
          {threshold !== undefined && <ReferenceLine y={threshold} stroke="#fb7185" strokeDasharray="3 3" />}
          <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
