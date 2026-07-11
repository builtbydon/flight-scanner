import { useEffect, useId, useLayoutEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** max-width class, e.g. "max-w-md". Default ~420px. */
  widthClass?: string;
  closeOnBackdrop?: boolean;
  /** Element to focus on open (e.g. a confirm button). Falls back to the dialog
   *  container so focus enters the modal for keyboard users. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** data-testid on the dialog element. */
  testId?: string;
}

/** Centered modal dialog over a dimmed backdrop. Escape + backdrop close.
 *  Manages focus: moves focus into the dialog on open and restores it to the
 *  previously focused element (the trigger) on close, and labels itself via
 *  aria-labelledby when a title is given. */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = "w-[420px] max-w-[90vw]",
  closeOnBackdrop = true,
  initialFocusRef,
  testId,
}: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // Capture the element focused at open time DURING render (before React commits
  // any autofocus inside the modal), so we restore to the real trigger on close.
  if (open && prevFocusRef.current === null) {
    prevFocusRef.current = (document.activeElement as HTMLElement) ?? null;
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Move focus in on open; restore on close/unmount.
  useLayoutEffect(() => {
    if (!open) return;
    (initialFocusRef?.current ?? dialogRef.current)?.focus();
    return () => {
      const prev = prevFocusRef.current;
      prevFocusRef.current = null;
      prev?.focus?.();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`bg-surface-800 border border-surface-700/50 rounded-lg shadow-2xl animate-slide-up outline-none ${widthClass}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        data-testid={testId}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-surface-700/40">
            <h2 id={titleId} className="text-sm font-semibold text-text-primary">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-7 h-7 flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-700/50 rounded-md transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        )}
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end items-center gap-2 px-4 py-3 border-t border-surface-700/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
