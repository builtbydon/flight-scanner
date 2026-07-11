import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

// Generic donut/pie chart on the house dark theme — completes the chart set
// (TimeSeriesChart, BarChartCard, Donut). Zero app coupling: feed {label,value}[]
// and an optional value formatter. Promoted from finance-tracker.

// House series palette (token hexes) so slices read on the dark-warm surface.
const PALETTE = ["#34d399", "#f7b13c", "#60a5fa", "#f87171", "#a78bfa", "#22d3ee",
  "#fb923c", "#4ade80", "#e879f9", "#facc15"];

export interface DonutSlice {
  label: string;
  value: number;
}

export interface DonutProps {
  data: DonutSlice[];
  height?: number;
  legend?: boolean;
  /** format a slice value for the tooltip + legend (default: raw number) */
  valueFormat?: (v: number) => string;
  emptyText?: string;
}

export function Donut({ data, height = 240, legend = true, valueFormat, emptyText = "No data yet." }: DonutProps) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-64 text-text-muted text-sm">{emptyText}</div>;
  }
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const fmt = (v: number) => (valueFormat ? valueFormat(v) : String(v));
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="85%"
               stroke="var(--color-surface-900)" strokeWidth={2}>
            {data.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
          </Pie>
          <Tooltip
            contentStyle={{ background: "var(--color-surface-700)", border: "1px solid var(--color-surface-600)", borderRadius: 10, fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", padding: "7px 11px" }}
            itemStyle={{ color: "var(--color-text-bright)", fontWeight: 600, padding: 0 }}
            labelStyle={{ color: "var(--color-text-secondary)" }}
            formatter={(v: number, n: string) => [fmt(v), n]} />
        </PieChart>
      </ResponsiveContainer>
      {legend && (
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          {data.map((d, i) => (
            <li key={i} className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="truncate text-text-secondary">{d.label}</span>
              <span className="ml-auto shrink-0 tabular-nums text-text-muted">
                {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
