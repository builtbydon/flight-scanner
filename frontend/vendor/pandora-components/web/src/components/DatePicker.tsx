import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";

/* GENERIC / promotion-candidate (ui.date-picker): a token-styled date field with
 * a typeable input AND a popup month calendar that renders through a portal (so it
 * floats above WebGL/overflow contexts). Zero app-domain coupling — value is an
 * ISO `YYYY-MM-DD` string; `min` blocks earlier dates. Pure --pb-* tokens. */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseTyped(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(d.getTime()) ? null : iso(d);
  }
  m = t.match(/^(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?$/);
  if (m) {
    const g3 = m[3];
    const year = g3 ? (g3.length === 2 ? 2000 + +g3 : +g3) : new Date().getFullYear();
    const d = new Date(year, Number(m[1]) - 1, Number(m[2]));
    return isNaN(d.getTime()) ? null : iso(d);
  }
  return null;
}

function pretty(isoStr: string): string {
  const [y = 0, mo = 1, da = 1] = isoStr.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

export interface DatePickerProps {
  label?: string;
  value: string; // ISO YYYY-MM-DD ("" = empty)
  onChange: (v: string) => void;
  min?: string; // ISO; earlier dates are blocked
  disabled?: boolean;
  placeholder?: string;
}

export function DatePicker({ label, value, onChange, min, disabled, placeholder }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ? pretty(value) : "");
  const [view, setView] = useState(() => (value ? new Date(value + "T00:00") : new Date()));
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value ? pretty(value) : ""), [value]);

  const reposition = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(r.left, window.innerWidth - 256 - 8)) });
  };

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const commitTyped = () => {
    const parsed = parseTyped(text);
    if (parsed && (!min || parsed >= min)) {
      onChange(parsed);
      setView(new Date(parsed + "T00:00"));
    } else {
      setText(value ? pretty(value) : "");
    }
  };

  const minDate = min ? new Date(min + "T00:00") : null;
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const popover = (
    <div
      ref={popRef}
      style={{ position: "fixed", top: pos.top, left: pos.left, width: 256, zIndex: 9999 }}
      className="rounded-lg border border-surface-700/60 bg-surface-800 p-3 shadow-2xl"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          className="rounded px-2 py-1 text-text-secondary hover:bg-surface-700/50 hover:text-text-primary cursor-pointer"
          onClick={() => setView(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          className="rounded px-2 py-1 text-text-secondary hover:bg-surface-700/50 hover:text-text-primary cursor-pointer"
          onClick={() => setView(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const isSel = value === iso(d);
          const disabledDay = minDate ? d < minDate : false;
          return (
            <button
              key={i}
              type="button"
              disabled={disabledDay}
              onClick={() => {
                onChange(iso(d));
                setOpen(false);
              }}
              className={`h-8 rounded text-xs cursor-pointer ${
                isSel
                  ? "bg-brand-500 font-semibold text-text-on-brand"
                  : disabledDay
                    ? "text-surface-600 cursor-not-allowed"
                    : "text-text-secondary hover:bg-surface-700/50"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={anchorRef}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-text-primary">{label}</span>}
      <div className="flex">
        <input
          className="w-full rounded-l-lg border border-r-0 border-surface-700/60 bg-surface-900 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim outline-none focus:ring-2 focus:ring-brand-600 disabled:opacity-50"
          value={text}
          disabled={disabled}
          placeholder={placeholder ?? "Type or pick a date"}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => !disabled && setOpen(true)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commitTyped();
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center rounded-r-lg border border-l-0 border-surface-700/60 bg-surface-700 px-2.5 text-text-secondary hover:bg-surface-600 hover:text-text-primary disabled:opacity-50 cursor-pointer"
          aria-label="Open calendar"
        >
          <Calendar size={15} />
        </button>
      </div>
      {open && !disabled && createPortal(popover, document.body)}
    </div>
  );
}
