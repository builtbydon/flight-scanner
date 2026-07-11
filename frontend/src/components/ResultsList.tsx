import { useMemo, useState } from "react";
import { Badge, SegmentedControl, type BadgeTone } from "pandora-components-web";
import type { DealLevel, FlightResult } from "../api";

export type ResultSort = "best" | "cheapest" | "fastest";
export const DEFAULT_RESULT_SORT: ResultSort = "best";

export function sortFlightResults(results: FlightResult[], sort: ResultSort = DEFAULT_RESULT_SORT): FlightResult[] {
  const copy = [...results];
  if (sort === "cheapest") copy.sort((a, b) => (a.priceValue ?? 9e9) - (b.priceValue ?? 9e9));
  else if (sort === "fastest") copy.sort((a, b) => (a.durationMinutes ?? 9e9) - (b.durationMinutes ?? 9e9));
  else copy.sort((a, b) => Number(b.isBest) - Number(a.isBest) || (a.priceValue ?? 9e9) - (b.priceValue ?? 9e9));
  return copy;
}

const DEAL_TONE: Record<DealLevel, BadgeTone> = {
  low: "success",
  typical: "warning",
  high: "error",
  unknown: "neutral",
};
const DEAL_LABEL: Record<DealLevel, string> = {
  low: "Good deal",
  typical: "Typical price",
  high: "Pricey",
  unknown: "No price data",
};

export function ResultsList({
  results,
  selectedId,
  onSelect,
}: {
  results: FlightResult[];
  selectedId: string | null;
  onSelect: (r: FlightResult) => void;
}) {
  const [sort, setSort] = useState<ResultSort>(DEFAULT_RESULT_SORT);

  const sorted = useMemo(() => {
    return sortFlightResults(results, sort);
  }, [results, sort]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-text-muted">{results.length} options</span>
        <SegmentedControl
          ariaLabel="Sort results"
          size="sm"
          value={sort}
          onChange={(v) => setSort(v as ResultSort)}
          options={[
            { value: "best", label: "Best" },
            { value: "cheapest", label: "Cheapest" },
            { value: "fastest", label: "Fastest" },
          ]}
        />
      </div>

      <ul className="space-y-2">
        {sorted.map((r) => (
          <li
            key={r.id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedId === r.id}
            onClick={() => onSelect(r)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(r);
              }
            }}
            className={`cursor-pointer rounded-lg border p-3 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
              selectedId === r.id
                ? "border-brand-500 bg-brand-500/10"
                : "border-surface-700/50 bg-surface-800 hover:border-surface-600"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-text-primary">
                    {r.airlines.join(", ") || "Multiple airlines"}
                  </span>
                  {r.isBest && <Badge tone="info">BEST</Badge>}
                </div>
                {(r.departure || r.arrival) && (
                  <div className="mt-1 text-xs font-medium text-text-secondary">
                    {r.departure || "—"}
                    <span className="text-text-muted"> → </span>
                    {r.arrival || "—"}
                    {r.arrivalTimeAhead && <span className="text-status-warning"> {r.arrivalTimeAhead}</span>}
                  </div>
                )}
                <div className="mt-0.5 text-xs text-text-muted">
                  {r.durationText} · {r.stops === 0 ? "Nonstop" : `${r.stops} stop${r.stops > 1 ? "s" : ""}`}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-lg font-bold text-text-primary">{r.priceText}</span>
                <Badge tone={DEAL_TONE[r.dealLevel]}>{DEAL_LABEL[r.dealLevel]}</Badge>
                {r.googleDeal && (
                  <span className="text-[10px] text-text-muted">Google: prices {r.googleDeal}</span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
