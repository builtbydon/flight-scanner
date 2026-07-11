import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "./Card";

export interface BarDatum {
  label: string;
  value: number;
}

export interface BarChartCardProps {
  title?: ReactNode;
  data: BarDatum[];
  /** SVG fill — defaults to the house brand token. Pass any --pb-* color var. */
  color?: string;
  height?: number;
  /** Horizontal bars (labels on the Y axis) — good for ranked category lists. */
  horizontal?: boolean;
  emptyText?: string;
}

/**
 * Generic, theme-token-driven bar chart in a house Card. ZERO app-domain
 * coupling: feed it {label, value}[] and it renders a dark-mode Recharts bar
 * chart that blends into surface cards. Promotion candidate for the shared lib.
 */
export function BarChartCard({
  title,
  data,
  color = "var(--color-brand-500)",
  height = 260,
  horizontal = false,
  emptyText = "No data yet.",
}: BarChartCardProps) {
  const axisStyle = { fill: "var(--color-text-muted)", fontSize: 11 };
  const grid = "var(--color-surface-700)";
  return (
    <Card title={title}>
      {data.length === 0 ? (
        <p className="text-sm text-text-muted py-8 text-center">{emptyText}</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {horizontal ? (
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
              <XAxis type="number" tick={axisStyle} stroke={grid} allowDecimals={false} />
              <YAxis type="category" dataKey="label" tick={axisStyle} stroke={grid} width={140} />
              <Tooltip
                cursor={{ fill: "var(--color-surface-700)", opacity: 0.3 }}
                contentStyle={{
                  background: "var(--color-surface-700)",
                  border: "1px solid var(--color-surface-600)",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  padding: "7px 11px",
                }}
                itemStyle={{ color: "var(--color-text-bright)", fontWeight: 600, padding: 0 }}
                labelStyle={{ color: "var(--color-text-secondary)" }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => <Cell key={i} fill={color} />)}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={data} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={axisStyle} stroke={grid} />
              <YAxis tick={axisStyle} stroke={grid} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: "var(--color-surface-700)", opacity: 0.3 }}
                contentStyle={{
                  background: "var(--color-surface-700)",
                  border: "1px solid var(--color-surface-600)",
                  borderRadius: 8,
                  fontSize: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  padding: "7px 11px",
                }}
                itemStyle={{ color: "var(--color-text-bright)", fontWeight: 600, padding: 0 }}
                labelStyle={{ color: "var(--color-text-secondary)" }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => <Cell key={i} fill={color} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      )}
    </Card>
  );
}
