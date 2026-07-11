import { useState } from "react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

const INPUT_CLASS =
  "w-full px-3 py-2 bg-surface-900 border border-surface-700/60 rounded-lg text-text-primary text-sm placeholder:text-text-dim focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-transparent disabled:opacity-50 transition-colors";

// `...rest` forwards arbitrary input attributes (data-testid, aria-label,
// onKeyDown, name, autoFocus, …) so consumers needing Enter-to-submit, a stable
// test id, etc. don't have to fall back to a raw <input>. (Requested by learning.)
export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password" | "email" | "number";
  description?: string;
  disabled?: boolean;
}

export function TextField({ label, value, onChange, placeholder, type = "text", description, disabled, ...rest }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-[13px] font-medium text-text-primary">{label}</span>}
      <input
        {...rest}
        className={INPUT_CLASS}
        value={value}
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {description && <span className="text-[12px] text-text-muted">{description}</span>}
    </label>
  );
}

export interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  description?: string;
  disabled?: boolean;
  rows?: number;
}

// Multiline counterpart to TextField; same label/description API. (From figma.)
export function TextAreaField({ label, value, onChange, placeholder, description, disabled, rows = 4, ...rest }: TextAreaFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-[13px] font-medium text-text-primary">{label}</span>}
      <textarea
        {...rest}
        className={`${INPUT_CLASS} resize-y`}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {description && <span className="text-[12px] text-text-muted">{description}</span>}
    </label>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  description?: string;
  disabled?: boolean;
}

export function SelectField({ label, value, onChange, options, description, disabled }: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-[13px] font-medium text-text-primary">{label}</span>}
      <select
        className={`${INPUT_CLASS} cursor-pointer`}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {description && <span className="text-[12px] text-text-muted">{description}</span>}
    </label>
  );
}

export interface ToggleFieldProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
  disabled?: boolean;
}

export function ToggleField({ label, checked, onChange, description, disabled }: ToggleFieldProps) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 relative w-9 h-5 shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-500" : "bg-surface-600"
        } ${disabled ? "" : "cursor-pointer"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-text-bright transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </button>
      <span className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-text-primary">{label}</span>
        {description && <span className="text-[12px] text-text-muted">{description}</span>}
      </span>
    </label>
  );
}

export interface CollapsibleSectionProps {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({ title, defaultOpen = false, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-surface-700/40 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-[13px] font-medium text-text-primary hover:bg-surface-800/50 cursor-pointer transition-colors"
      >
        {title}
        <ChevronDown size={15} className={`text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 py-3 border-t border-surface-700/40">{children}</div>}
    </div>
  );
}
