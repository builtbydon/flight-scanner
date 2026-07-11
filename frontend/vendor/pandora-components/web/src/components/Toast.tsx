import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, Info, TriangleAlert, X } from "lucide-react";

export type ToastKind = "info" | "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  info: (message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast API. Must be inside a <ToastProvider>. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

const TONE: Record<ToastKind, { cls: string; icon: ReactNode }> = {
  info: { cls: "bg-surface-800 border-surface-700 text-text-primary", icon: <Info size={14} /> },
  success: { cls: "bg-status-running/10 border-status-running/40 text-status-running", icon: <Check size={14} /> },
  error: { cls: "bg-status-error/10 border-status-error/40 text-status-error", icon: <TriangleAlert size={14} /> },
};

export interface ToastProviderProps {
  children: ReactNode;
  /** Auto-dismiss after this many ms (default 4000). */
  ttlMs?: number;
}

/** Toast notifications: stacked bottom-right, auto-dismiss. Wrap your app in it. */
export function ToastProvider({ children, ttlMs = 4000 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((t) => [...t, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), ttlMs);
    },
    [dismiss, ttlMs],
  );

  const api: ToastApi = {
    info: (m) => push("info", m),
    success: (m) => push("success", m),
    error: (m) => push("error", m),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-[min(90vw,360px)]">
        {toasts.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    // mount only; auto-dismiss handled by provider timer
  }, []);
  const tone = TONE[toast.kind];
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-md border shadow-lg animate-slide-up text-sm ${tone.cls}`}
      role="status"
    >
      <span className="mt-0.5 shrink-0">{tone.icon}</span>
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100 cursor-pointer" aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}
