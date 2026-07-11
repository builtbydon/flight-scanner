import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "lucide-react";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function pretty(iso: string): string {
  if (!iso) return "";
  const [y = 0, mo = 1, da = 1] = iso.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString(undefined, {
    weekday: "short", month: "short", day: "numeric",
  });
}

export interface DateRangePickerProps {
  departDate: string;
  returnDate: string;
  onDepartChange: (v: string) => void;
  onReturnChange: (v: string) => void;
  min?: string;
  isRoundTrip: boolean;
}

export function DateRangePicker({
  departDate,
  returnDate,
  onDepartChange,
  onReturnChange,
  min,
  isRoundTrip,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  // which leg we're currently picking
  const [selecting, setSelecting] = useState<"depart" | "return">("depart");
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [view, setView] = useState(() => {
    const seed = departDate || min || "";
    return seed ? new Date(seed + "T00:00") : new Date();
  });
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const reposition = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 288; // popup width
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    setPos({ top: r.bottom + 6, left });
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

  // Escape closes the popover (keyboard users can't rely on an outside click).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        anchorRef.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const openFor = (which: "depart" | "return") => {
    // If opening for return but no depart date yet, start with depart first
    if (which === "return" && !departDate) which = "depart";
    setSelecting(which);
    if (!open) {
      // Scroll view to show relevant month
      const seed = which === "return" ? (returnDate || departDate) : departDate;
      if (seed) setView(new Date(seed + "T00:00"));
    }
    setOpen(true);
  };

  const handleDayClick = (d: Date) => {
    const clicked = toISO(d);
    if (!isRoundTrip || selecting === "depart") {
      onDepartChange(clicked);
      // If new depart is after existing return, clear return
      if (returnDate && clicked >= returnDate) onReturnChange("");
      if (isRoundTrip) {
        setSelecting("return");
        // Keep calendar open for return
      } else {
        setOpen(false);
      }
    } else {
      // selecting === "return"
      if (!departDate) {
        // No departure yet (e.g. jumped straight to the Return tab): treat the
        // first click as the departure rather than a return-only selection.
        onDepartChange(clicked);
        setSelecting("return");
      } else if (clicked <= departDate) {
        // Clicked on or before depart — restart as new depart
        onDepartChange(clicked);
        onReturnChange("");
        setSelecting("return");
      } else {
        onReturnChange(clicked);
        setOpen(false);
      }
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

  // The effective "end" of the highlighted range (hover preview when picking return)
  const previewEnd =
    isRoundTrip && selecting === "return" && hoverDate && departDate && hoverDate > departDate
      ? hoverDate
      : returnDate;

  const popover = (
    <div
      ref={popRef}
      role="dialog"
      aria-label="Choose travel dates"
      style={{ position: "fixed", top: pos.top, left: pos.left, width: 288, zIndex: 9999 }}
      className="rounded-xl border border-surface-700/60 bg-surface-800 p-3 shadow-2xl"
      onMouseLeave={() => setHoverDate(null)}
    >
      {/* Depart / Return tabs (round-trip only) */}
      {isRoundTrip && (
        <div className="mb-3 flex gap-1 rounded-lg bg-surface-700/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => openFor("depart")}
            className={`flex-1 rounded-md py-1.5 text-center font-medium transition-colors cursor-pointer ${
              selecting === "depart"
                ? "bg-brand-500 text-white shadow"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Depart {departDate ? `· ${pretty(departDate)}` : ""}
          </button>
          <button
            type="button"
            onClick={() => openFor("return")}
            className={`flex-1 rounded-md py-1.5 text-center font-medium transition-colors cursor-pointer ${
              selecting === "return"
                ? "bg-brand-500 text-white shadow"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Return {returnDate ? `· ${pretty(returnDate)}` : ""}
          </button>
        </div>
      )}

      {/* Month navigation */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className="rounded px-2 py-1 text-text-secondary hover:bg-surface-700/50 hover:text-text-primary cursor-pointer"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setView(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {MONTHS[month]} {year}
        </span>
        <button
          type="button"
          aria-label="Next month"
          className="rounded px-2 py-1 text-text-secondary hover:bg-surface-700/50 hover:text-text-primary cursor-pointer"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setView(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 text-center text-[10px] text-text-muted">
        {WEEKDAYS.map((w) => <div key={w} className="py-1">{w}</div>)}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-9" />;

          const dStr = toISO(d);
          const isDepart = dStr === departDate;
          const isReturn = isRoundTrip && dStr === returnDate;
          const isPreviewEnd = isRoundTrip && selecting === "return" && dStr === hoverDate && hoverDate > (departDate || "");

          const inRange = Boolean(
            isRoundTrip && departDate && previewEnd && dStr > departDate && dStr < previewEnd
          );

          // Disabled: before min, or (when picking return) before or equal to depart
          const disabledDay =
            (minDate ? d < minDate : false) ||
            (isRoundTrip && selecting === "return" && departDate ? dStr <= departDate : false);

          // Range band background logic
          const hasRange = Boolean(isRoundTrip && departDate && previewEnd && departDate < previewEnd);
          const dayOfWeek = d.getDay();
          const isRowStart = dayOfWeek === 0 || d.getDate() === 1;
          const isRowEnd = dayOfWeek === 6 || d.getDate() === daysInMonth;

          // The band color behind each cell (creates the highlighted strip between dates)
          let bandClass = "";
          if (hasRange) {
            const isRangeStart = isDepart;
            const isRangeEnd = isReturn || isPreviewEnd;

            if (isRangeStart && isRangeEnd) {
              bandClass = ""; // single-day range: no band
            } else if (isRangeStart) {
              bandClass = "bg-brand-500/20 rounded-l-full";
            } else if (isRangeEnd) {
              bandClass = "bg-brand-500/20 rounded-r-full";
            } else if (inRange) {
              // Middle of range — cap at row boundaries
              const leftCap = isRowStart ? "rounded-l-full" : "";
              const rightCap = isRowEnd ? "rounded-r-full" : "";
              bandClass = `bg-brand-500/20 ${leftCap} ${rightCap}`.trim();
            }
          }

          const isSelectedEndpoint = isDepart || isReturn || isPreviewEnd;

          return (
            <div key={i} className={`relative flex h-9 items-center justify-center ${bandClass}`}>
              <button
                type="button"
                disabled={disabledDay}
                onMouseEnter={() => !disabledDay && setHoverDate(dStr)}
                onClick={() => !disabledDay && handleDayClick(d)}
                className={`z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors
                  ${
                    isSelectedEndpoint
                      ? "bg-brand-500 text-white font-bold shadow-sm cursor-pointer"
                      : disabledDay
                        ? "text-surface-600 cursor-not-allowed"
                        : inRange
                          ? "text-text-primary hover:bg-brand-500/30 cursor-pointer"
                          : "text-text-secondary hover:bg-surface-700/60 cursor-pointer"
                  }`}
              >
                {d.getDate()}
              </button>
            </div>
          );
        })}
      </div>

      {/* Instruction hint */}
      <p className="mt-2 text-center text-[10px] text-text-muted">
        {isRoundTrip
          ? selecting === "depart"
            ? "Select a departure date"
            : departDate
              ? "Now select a return date"
              : "Select a departure date first"
          : "Select a departure date"}
      </p>
    </div>
  );

  return (
    <div ref={anchorRef} className="grid grid-cols-2 gap-3">
      {/* Depart input */}
      <div>
        <span className="mb-1.5 block text-[13px] font-medium text-text-primary">Depart</span>
        <div className="flex">
          <input
            readOnly
            className={`w-full cursor-pointer rounded-l-lg border border-r-0 border-surface-700/60 bg-surface-900 px-3 py-2 text-sm outline-none transition-all ${
              departDate ? "text-text-primary" : "text-text-dim"
            } ${open && selecting === "depart" ? "ring-2 ring-brand-600 border-brand-600" : "focus:ring-2 focus:ring-brand-600"}`}
            value={departDate ? pretty(departDate) : ""}
            placeholder="Depart date"
            onFocus={() => openFor("depart")}
            onClick={() => openFor("depart")}
          />
          <button
            type="button"
            onClick={() => openFor("depart")}
            className="flex items-center rounded-r-lg border border-l-0 border-surface-700/60 bg-surface-700 px-2.5 text-text-secondary hover:bg-surface-600 hover:text-text-primary cursor-pointer"
            aria-label="Open calendar for departure"
          >
            <Calendar size={15} />
          </button>
        </div>
      </div>

      {/* Return input */}
      <div>
        <span className={`mb-1.5 block text-[13px] font-medium ${isRoundTrip ? "text-text-primary" : "text-text-muted"}`}>
          Return
        </span>
        <div className="flex">
          <input
            readOnly
            disabled={!isRoundTrip}
            className={`w-full rounded-l-lg border border-r-0 border-surface-700/60 bg-surface-900 px-3 py-2 text-sm outline-none transition-all disabled:opacity-50 ${
              isRoundTrip ? "cursor-pointer" : "cursor-not-allowed"
            } ${returnDate ? "text-text-primary" : "text-text-dim"} ${
              open && selecting === "return" ? "ring-2 ring-brand-600 border-brand-600" : ""
            }`}
            value={returnDate ? pretty(returnDate) : ""}
            placeholder="Return date"
            onFocus={() => isRoundTrip && openFor("return")}
            onClick={() => isRoundTrip && openFor("return")}
          />
          <button
            type="button"
            disabled={!isRoundTrip}
            onClick={() => isRoundTrip && openFor("return")}
            className="flex items-center rounded-r-lg border border-l-0 border-surface-700/60 bg-surface-700 px-2.5 text-text-secondary hover:bg-surface-600 hover:text-text-primary disabled:opacity-50 cursor-pointer"
            aria-label="Open calendar for return"
          >
            <Calendar size={15} />
          </button>
        </div>
      </div>

      {open && createPortal(popover, document.body)}
    </div>
  );
}
