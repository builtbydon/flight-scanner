import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  testId?: string;
}

/** Confirmation modal with cancel/confirm actions (danger variant for
 *  destructive). The confirm button is focused on open so Enter activates it;
 *  Enter pressed elsewhere in the dialog also confirms (once, never while
 *  loading, never when focus is already on a button so it can't double-fire),
 *  and Escape cancels (via Modal). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
  children,
  testId,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || loading) return;
      // A focused button activates natively on Enter; only handle Enter when
      // focus is elsewhere, so we never double-fire.
      const t = e.target as HTMLElement | null;
      if (t && t.tagName === "BUTTON") return;
      e.preventDefault();
      onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, loading, onConfirm]);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      testId={testId}
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {message && <p className="text-[13px] text-text-secondary leading-relaxed">{message}</p>}
      {children}
    </Modal>
  );
}
