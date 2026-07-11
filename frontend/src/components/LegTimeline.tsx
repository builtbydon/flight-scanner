import type { FlightResult, ReturnItinerary } from "../api";

// "+1" -> "+1 day", "+2" -> "+2 days" (backend emits just the "+n" offset).
function dayOffsetLabel(ahead: string): string {
  const n = Math.abs(parseInt(ahead, 10));
  return `${ahead} day${n === 1 ? "" : "s"}`;
}

// Accepts either the outbound (FlightResult) or the return itinerary — this only
// renders leg/time fields, which both carry.
export function LegTimeline({ result }: { result: FlightResult | ReturnItinerary }) {
  const { legs, layovers } = result;

  return (
    <div className="space-y-0">
      {(result.departure || result.arrival) && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-900 px-3 py-2">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Departs</div>
            <div className="text-sm font-semibold text-text-primary">{result.departure || "—"}</div>
          </div>
          <div className="px-2 text-text-muted">✈</div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wide text-text-muted">Arrives</div>
            <div className="text-sm font-semibold text-text-primary">
              {result.arrival || "—"}
              {result.arrivalTimeAhead && (
                <span className="ml-1 text-status-warning">{dayOffsetLabel(result.arrivalTimeAhead)}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {legs.map((leg, i) => (
        <div key={i}>
          <div className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="h-3 w-3 rounded-full bg-sky-400" />
              <div className="w-px flex-1 bg-surface-700/60" />
            </div>
            <div className="pb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-text-primary">
                  {leg.from} → {leg.to}
                </span>
                <span className="text-xs text-text-muted">{leg.durationText}</span>
              </div>
              <div className="text-xs text-text-muted">
                {leg.fromCity} to {leg.toCity}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-secondary">
                <span>✈ {leg.airline}{leg.flightNumber ? ` ${leg.flightNumber}` : ""}</span>
                <span className="text-text-muted">
                  🛩 {leg.aircraft && leg.aircraft.trim() ? leg.aircraft : "Aircraft: n/a"}
                </span>
              </div>
            </div>
          </div>

          {layovers[i] && (
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="h-2.5 w-2.5 rounded-full border-2 border-status-warning bg-surface-900" />
                <div className="w-px flex-1 bg-surface-700/60" />
              </div>
              <div className="pb-4">
                <div
                  className={`text-xs font-semibold ${
                    layovers[i].short ? "text-status-error" : layovers[i].long ? "text-status-warning" : "text-text-secondary"
                  }`}
                >
                  Layover in {layovers[i].city} ({layovers[i].airport}) · {layovers[i].durationText}
                  {layovers[i].short && " ⚠ tight connection"}
                  {layovers[i].long && " ⚠ long wait"}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <div className="h-3 w-3 rounded-full bg-status-running" />
        </div>
        <div className="text-xs text-text-muted">
          Arrive {legs[legs.length - 1]?.toCity}
          {result.arrivalTimeAhead ? ` (${dayOffsetLabel(result.arrivalTimeAhead)})` : ""}
        </div>
      </div>

      {!result.legsDetailed && result.stops > 0 && (
        <p className="mt-3 rounded-lg border border-surface-700/40 bg-surface-900/60 p-2 text-[11px] text-text-muted">
          Note: this result has {result.stops} stop{result.stops > 1 ? "s" : ""}, but the layover airport
          couldn't be resolved, so the map shows the overall route.
        </p>
      )}
      {result.legsDetailed && result.estimated && result.legs.length > 1 && (
        <p className="mt-3 rounded-lg border border-surface-700/40 bg-surface-900/60 p-2 text-[11px] text-text-muted">
          Layover airports &amp; times are exact (from Google Flights). Per-leg flight times are estimated
          from distance, since Google only publishes the total. Aircraft type isn't provided.
        </p>
      )}
    </div>
  );
}
