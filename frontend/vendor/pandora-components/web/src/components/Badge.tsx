import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "accent"
  | "success"
  | "warning"
  | "error"
  | "info";

export interface BadgeProps {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}

const TONE: Record<BadgeTone, string> = {
  neutral: "bg-surface-700 text-text-secondary",
  brand: "bg-brand-500/15 text-brand-400",
  accent: "bg-accent-600/15 text-accent-600",
  success: "bg-status-running/15 text-status-running",
  warning: "bg-status-waiting/15 text-status-waiting",
  error: "bg-status-error/15 text-status-error",
  info: "bg-status-unread/15 text-status-unread",
};

/** Small status/label pill. */
export function Badge({ tone = "neutral", children, className = "", icon }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${TONE[tone]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
