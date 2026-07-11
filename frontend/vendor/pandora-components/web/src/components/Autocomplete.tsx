import { useEffect, useRef, useState } from "react";

/* GENERIC / promotion-candidate (ui.autocomplete): a debounced async combobox.
 * Caller supplies `fetchOptions(query) => Promise<Option[]>` and an onSelect; the
 * component owns debouncing, keyboard nav, and the dropdown. Zero app-domain
 * coupling; pure --pb-* tokens. */

export interface AutocompleteOption {
  id: string;
  label: string;
  sublabel?: string;
  /** Text shown in the input after selection (defaults to `label`). */
  displayValue?: string;
}

export interface AutocompleteProps {
  label?: string;
  value: string;
  placeholder?: string;
  minChars?: number;
  debounceMs?: number;
  fetchOptions: (query: string) => Promise<AutocompleteOption[]>;
  onSelect: (option: AutocompleteOption | null, rawText: string) => void;
}

export function Autocomplete({
  label,
  value,
  placeholder,
  minChars = 2,
  debounceMs = 160,
  fetchOptions,
  onSelect,
}: AutocompleteProps) {
  const [text, setText] = useState(value);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value), [value]);

  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    if (q.length < minChars) {
      setOptions([]);
      return;
    }
    const h = setTimeout(async () => {
      try {
        setOptions(await fetchOptions(q));
        setActive(0);
      } catch {
        setOptions([]);
      }
    }, debounceMs);
    return () => clearTimeout(h);
  }, [text, open, minChars, debounceMs, fetchOptions]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (opt: AutocompleteOption) => {
    const display = opt.displayValue ?? opt.label;
    setText(display);
    onSelect(opt, display);
    setOpen(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      {label && <span className="mb-1.5 block text-[13px] font-medium text-text-primary">{label}</span>}
      <input
        className="w-full rounded-lg border border-surface-700/60 bg-surface-900 px-3 py-2 text-sm text-text-primary placeholder:text-text-dim outline-none focus:ring-2 focus:ring-brand-600"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          onSelect(null, e.target.value);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open || !options.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const opt = options[active];
            if (opt) choose(opt);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && options.length > 0 && (
        <ul className="absolute z-[1000] mt-1 max-h-72 w-full overflow-auto rounded-lg border border-surface-700/60 bg-surface-800 shadow-2xl">
          {options.map((opt, i) => (
            <li
              key={opt.id}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === active ? "bg-brand-500/15" : "hover:bg-surface-700/50"
              }`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(opt);
              }}
            >
              <span className="font-semibold text-brand-400">{opt.id}</span>{" "}
              <span className="text-text-primary">{opt.label}</span>
              {opt.sublabel && <span className="text-text-muted"> · {opt.sublabel}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
