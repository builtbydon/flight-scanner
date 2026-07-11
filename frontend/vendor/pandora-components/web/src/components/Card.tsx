import type { ReactNode } from "react";

export interface CardProps {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}

/** Surface card with optional title row + actions. */
export function Card({ title, actions, children, className = "", padded = true }: CardProps) {
  return (
    <div
      className={`bg-surface-800 border border-surface-700/50 rounded-lg shadow-lg ${
        padded ? "p-5" : ""
      } ${className}`}
    >
      {(title || actions) && (
        <div className={`flex items-center justify-between gap-3 ${padded ? "mb-4" : "p-5 pb-0"}`}>
          {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
          {actions && <div className="flex items-center gap-1.5">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
