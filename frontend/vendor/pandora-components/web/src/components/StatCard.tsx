import type { ReactNode } from "react";

export type StatTone = "neutral" | "brand" | "success" | "warning" | "error" | "accent";

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  tone?: StatTone;
  className?: string;
}

const ACCENT: Record<StatTone, string> = {
  neutral: "text-text-primary",
  brand: "text-brand-400",
  success: "text-status-running",
  warning: "text-status-waiting",
  error: "text-status-error",
  accent: "text-accent-600",
};

/** KPI / stat tile: label, big value, optional sub + icon. */
export function StatCard({ label, value, sub, icon, tone = "neutral", className = "" }: StatCardProps) {
  return (
    <div
      className={`relative overflow-hidden bg-surface-800 border border-surface-700/50 rounded-lg p-4 flex flex-col gap-1 ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-text-muted">{label}</span>
        {icon && <span className={ACCENT[tone]}>{icon}</span>}
      </div>
      <span className={`text-2xl font-bold tabular-nums tracking-tight ${ACCENT[tone]}`}>{value}</span>
      {sub && <span className="text-[12px] text-text-muted">{sub}</span>}
    </div>
  );
}
