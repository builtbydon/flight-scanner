import type { ReactNode } from "react";
import { ArrowLeft, X } from "lucide-react";

export interface PageShellProps {
  title: ReactNode;
  icon?: ReactNode;
  /** Back arrow (mobile/nested). */
  onBack?: () => void;
  /** Close X (full-screen overlay views). */
  onClose?: () => void;
  actions?: ReactNode;
  children: ReactNode;
  /** Constrain content to a readable column. */
  maxWidthClass?: string;
}

/** Full-height page/view shell: sticky header (icon + title + actions) over a
 *  scrollable body. The house pattern behind Notes / Components / settings views. */
export function PageShell({
  title,
  icon,
  onBack,
  onClose,
  actions,
  children,
  maxWidthClass,
}: PageShellProps) {
  return (
    <div className="flex flex-col h-dvh bg-surface-900 text-text-primary">
      <div className="flex items-center justify-between gap-3 border-b border-surface-700/30 px-4 py-2.5">
        <h1 className="flex items-center gap-2 text-sm font-semibold min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="w-7 h-7 -ml-1 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-800/50 rounded-md transition-colors cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {icon && <span className="text-brand-400 shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
        </h1>
        <div className="flex items-center gap-1">
          {actions}
          {onClose && (
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-800/50 rounded-md transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {maxWidthClass ? <div className={`mx-auto ${maxWidthClass} px-5 py-5`}>{children}</div> : children}
      </div>
    </div>
  );
}
