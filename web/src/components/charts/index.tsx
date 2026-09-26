// Recharts wrappers in the design system's colours (read from the theme at render time).
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { themeColor, useUi } from "@/state/ui";

export interface SeriesLine { key: string; name: string; color?: string; token?: string; dashed?: boolean }
export interface RefLine { y: number; label: string; token?: string }

function useChartTheme() {
  useUi((s) => s.theme); // re-render on theme change
  return { grid: themeColor("line"), axis: themeColor("ink-3"), surface: themeColor("surface"), ink: themeColor("ink"), line2: themeColor("line-2") };
}

const colorOf = (l: { color?: string; token?: string }) => l.color ?? themeColor(l.token ?? "brand");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function SeriesChart({ data, lines, refs = [], domain, height = 240, xKey = "i", area = false }: {
  data: Record<string, any>[]; lines: SeriesLine[]; refs?: RefLine[]; domain?: [number, number]; height?: number; xKey?: string; area?: boolean;
}) {
  const t = useChartTheme();
  const tooltip = (
    <Tooltip contentStyle={{ background: t.surface, border: `1px solid ${t.line2}`, borderRadius: 14, fontFamily: "JetBrains Mono", fontSize: 13, color: t.ink, boxShadow: "0 16px 30px -18px rgba(0,0,0,.4)" }}
      formatter={(v: number) => (typeof v === "number" ? (Math.abs(v) < 1 ? v.toFixed(4) : v.toFixed(3)) : v)} />
  );
  const axes = (
    <>
      <CartesianGrid stroke={t.grid} strokeDasharray="3 6" vertical={false} />
      <XAxis dataKey={xKey} stroke={t.axis} tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} />
      <YAxis stroke={t.axis} tick={{ fontSize: 12, fontFamily: "JetBrains Mono" }} tickLine={false} axisLine={false} width={48} domain={domain ?? ["auto", "auto"]} />
      {refs.map((r) => (
        <ReferenceLine key={r.label} y={r.y} stroke={themeColor(r.token ?? "bad")} strokeDasharray="5 5"
          label={{ value: r.label, position: "insideTopRight", fill: themeColor(r.token ?? "bad"), fontSize: 12, fontFamily: "JetBrains Mono" }} />
      ))}
      {tooltip}
      {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 13, fontFamily: "Manrope", paddingTop: 6 }} iconType="circle" />}
    </>
  );
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        {area ? (
          <AreaChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {lines.map((l) => (
                <linearGradient key={l.key} id={`g-${l.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorOf(l)} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={colorOf(l)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {axes}
            {lines.map((l) => <Area key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={colorOf(l)} strokeWidth={2.4} fill={`url(#g-${l.key})`} dot={false} strokeDasharray={l.dashed ? "6 5" : undefined} connectNulls />)}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
            {axes}
            {lines.map((l) => <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={colorOf(l)} strokeWidth={2.4} dot={false} strokeDasharray={l.dashed ? "6 5" : undefined} connectNulls />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny inline trend line (no axes). */
export function Sparkline({ values, threshold, height = 44, token = "brand" }: { values: number[]; threshold?: number; height?: number; token?: string }) {
  useUi((s) => s.theme);
  if (values.length < 2) return <div style={{ height }} className="flex items-center text-[13px] text-ink-3">not enough data yet</div>;
  const max = Math.max(...values, threshold ?? 0) * 1.1 || 1;
  const w = 200;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - (v / max) * height}`).join(" ");
  const color = themeColor(token);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} aria-hidden>
      <defs>
        <linearGradient id={`sp-${token}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${w},${height}`} fill={`url(#sp-${token})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      {threshold !== undefined && <line x1={0} x2={w} y1={height - (threshold / max) * height} y2={height - (threshold / max) * height} stroke={themeColor("bad")} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}
