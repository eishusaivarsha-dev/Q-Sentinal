import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface SeriesLine { key: string; name: string; color: string }
export interface RefLine { y: number; label: string; color: string }

const AX = { stroke: "#5f5442", fontSize: 10, fontFamily: "IBM Plex Mono" };
const TT = { background: "#14110c", border: "1px solid rgba(240,165,58,.35)", borderRadius: 6, fontFamily: "IBM Plex Mono", fontSize: 11 };

/** Strip-chart recorder with threshold lines. */
export default function SeriesChart({ data, lines, refs = [], height = 220, domain, xKey = "i", logY }: {
  data: Record<string, unknown>[]; lines: SeriesLine[]; refs?: RefLine[]; height?: number; domain?: [number, number]; xKey?: string; logY?: boolean;
}) {
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid stroke="#f0a53a" strokeOpacity={0.07} />
          <XAxis dataKey={xKey} {...AX} tickLine={false} />
          <YAxis {...AX} tickLine={false} domain={domain ?? ["auto", "auto"]} scale={logY ? "log" : "auto"} allowDataOverflow={logY} />
          <Tooltip contentStyle={TT} labelStyle={{ color: "#8a7c62" }} />
          {lines.length > 1 && <Legend wrapperStyle={{ fontFamily: "Oswald", fontSize: 11, letterSpacing: 1 }} />}
          {refs.map((r) => (
            <ReferenceLine key={r.label} y={r.y} stroke={r.color} strokeDasharray="4 4"
              label={{ value: r.label, fill: r.color, fontSize: 10, fontFamily: "Oswald", position: "insideTopRight" }} />
          ))}
          {lines.map((l) => (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, color = "#ffc15e", threshold, baseline, height = 40 }: { values: number[]; color?: string; threshold?: number; baseline?: number; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
          <YAxis hide domain={[0, Math.max(threshold ?? 0, ...values, 0.02) * 1.15]} />
          {threshold !== undefined && <ReferenceLine y={threshold} stroke="#e0513a" strokeDasharray="3 3" />}
          {baseline !== undefined && <ReferenceLine y={baseline} stroke="#8a7c62" strokeDasharray="2 4" />}
          <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
