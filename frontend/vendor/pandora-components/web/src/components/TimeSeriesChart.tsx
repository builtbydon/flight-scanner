import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

export interface SeriesDef {
  /** key into each data row */
  dataKey: string;
  /** legend label */
  name: string;
  /** line color; defaults cycle through the house palette */
  color?: string;
  dashed?: boolean;
}

export interface TimeSeriesChartProps {
  data: Array<Record<string, unknown>>;
  series: SeriesDef[];
  xKey: string;
  height?: number;
  /** format a Y value for the tooltip/axis */
  valueFormat?: (v: number) => string;
  /** format an X value for the axis ticks */
  xFormat?: (v: string) => string;
}

// House palette (token hexes) so lines read on the dark-warm surface.
const PALETTE = ["#34d399", "#f7b13c", "#60a5fa", "#f87171", "#a78bfa", "#22d3ee",
  "#fb923c", "#4ade80", "#e879f9", "#facc15"];

/**
 * GENERIC multi-line time-series chart. Zero app-domain coupling — pass data +
 * series defs. Styled with the house dark theme. Promotion candidate:
 * pandora-components TimeSeriesChart.
 */
export function TimeSeriesChart({
  data, series, xKey, height = 320, valueFormat, xFormat,
}: TimeSeriesChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke="#3f3f46" strokeOpacity={0.4} vertical={false} />
        <XAxis
          dataKey={xKey} tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46"
          tickFormatter={xFormat} minTickGap={32}
        />
        <YAxis
          tick={{ fill: "#a1a1aa", fontSize: 11 }} stroke="#3f3f46" width={64}
          tickFormatter={valueFormat ? (v) => valueFormat(Number(v)) : undefined}
          domain={["auto", "auto"]}
        />
        <Tooltip
          contentStyle={{ background: "#3f3f46", border: "1px solid #52525b", borderRadius: 8, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "7px 11px" }}
          labelStyle={{ color: "#d4d4d8", marginBottom: 2 }}
          itemStyle={{ fontWeight: 600, padding: 0 }}
          formatter={(v: number) => (valueFormat ? valueFormat(v) : v)}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s, i) => (
          <Line
            key={s.dataKey} type="monotone" dataKey={s.dataKey} name={s.name}
            stroke={s.color || PALETTE[i % PALETTE.length]} strokeWidth={2}
            strokeDasharray={s.dashed ? "5 4" : undefined} dot={false} isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
