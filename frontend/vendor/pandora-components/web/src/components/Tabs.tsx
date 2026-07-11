import type { ReactNode } from "react";

/**
 * Tabs — generic, domain-free underline tab bar for the house design system.
 *
 * Horizontal underline-style tab strip styled with the shared tokens (brand
 * accent + warm-gray surfaces). Controlled: the parent owns the active key.
 * Horizontally scrollable so it never overflows on narrow / mobile viewports —
 * distinct from SegmentedControl (fixed inline pills for 2–5 short options).
 * Promoted from figma-localization.
 */
export interface TabItem {
  /** Stable identifier returned by onChange. */
  key: string;
  /** Visible label (string or node). */
  label: ReactNode;
  /** Optional leading icon. */
  icon?: ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  /** Key of the currently-active tab. */
  active: string;
  onChange: (key: string) => void;
  /** Accessible label for the tablist. */
  ariaLabel?: string;
  className?: string;
}

export function Tabs({ tabs, active, onChange, ariaLabel, className = "" }: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex gap-1 overflow-x-auto border-b border-surface-700/50 ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {tabs.map((t) => {
        const selected = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.key)}
            className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
              selected
                ? "border-brand-500 text-text-bright"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
