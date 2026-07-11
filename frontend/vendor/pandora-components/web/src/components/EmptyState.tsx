import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Centered empty/zero state with optional icon + call to action. */
export function EmptyState({ icon, title, message, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-2 py-12 px-6 ${className}`}>
      {icon && <div className="text-text-muted">{icon}</div>}
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {message && <p className="text-[13px] text-text-secondary max-w-sm">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
