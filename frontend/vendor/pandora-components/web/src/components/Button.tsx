import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-500 text-text-on-brand hover:bg-brand-600",
  secondary: "bg-surface-700 text-text-secondary hover:bg-surface-600 hover:text-text-primary",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-800/50",
  danger: "bg-status-error/10 text-status-error border border-status-error/40 hover:bg-status-error/20",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-2 text-sm",
};

/** House button — variants (primary/secondary/ghost/danger), sizes, icon + loading.
 *  Forwards its ref so callers (e.g. a dialog autofocusing its confirm action)
 *  can focus it. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, loading = false, children, className = "", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={size === "sm" ? 13 : 14} /> : icon}
      {children}
    </button>
  );
});
