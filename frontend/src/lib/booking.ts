// Build deep links that forward the user to actually book a flight.
// We send them to Google Flights (same data source) and Kayak as a backup,
// pre-filled with the route, dates, cabin and passengers.

interface BookingQuery {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  trip: string;
  seat: string;
  adults: number;
  maxStops?: number | null;
  airlineCode?: string | null;
}

const CABIN_WORD: Record<string, string> = {
  economy: "economy",
  "premium-economy": "premium economy",
  business: "business class",
  first: "first class",
};

export function googleFlightsUrl(q: BookingQuery): string {
  const cabin = CABIN_WORD[q.seat] ?? "economy";
  const pax = `${q.adults} adult${q.adults > 1 ? "s" : ""}`;
  let phrase = `Flights from ${q.origin} to ${q.destination} on ${q.departDate}`;
  // Say "one way" explicitly — otherwise Google's NL parser tends to assume a
  // round trip and auto-picks a return date, showing bundled prices.
  if (q.trip === "round-trip" && q.returnDate) phrase += ` returning ${q.returnDate}`;
  else phrase += " one way";
  phrase += ` ${cabin} for ${pax}`;
  if (q.maxStops === 0) phrase += " nonstop";
  else if (typeof q.maxStops === "number") phrase += ` ${q.maxStops} stop or fewer`;
  if (q.airlineCode) phrase += ` ${q.airlineCode}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(phrase)}`;
}

// Kayak's URL cabin tokens ("premiumeconomy" is not one of them).
const KAYAK_CABIN: Record<string, string> = {
  economy: "",
  "premium-economy": "/premium",
  business: "/business",
  first: "/first",
};

// The parts of a selected itinerary we can push into Kayak's result filters so
// the page opens narrowed to that flight rather than the whole market.
export interface SelectedFlight {
  airlineCodes?: string[];
  stops?: number | null;
}

// Kayak encodes result filters in an `fs=` query param: `airlines=<codes>` (comma
// separated) and `stops=<max>` (0 = nonstop), joined by `;`. Unknown/omitted
// filters are ignored by Kayak, so this degrades to the plain search.
export function kayakUrl(q: BookingQuery, selected?: SelectedFlight | null): string {
  const seg =
    q.trip === "round-trip" && q.returnDate
      ? `${q.origin}-${q.destination}/${q.departDate}/${q.returnDate}`
      : `${q.origin}-${q.destination}/${q.departDate}`;
  const cabin = KAYAK_CABIN[q.seat] ?? "";
  // Kayak encodes travelers as a path segment; omitting it means 1 adult.
  const pax = q.adults > 1 ? `/${q.adults}adults` : "";

  const filters: string[] = [];
  const codes = Array.from(
    new Set((selected?.airlineCodes ?? []).map((c) => c.trim().toUpperCase())),
  ).filter((c) => /^[A-Z0-9]{2}$/.test(c));
  if (codes.length) filters.push(`airlines=${codes.join(",")}`);
  if (selected && typeof selected.stops === "number" && selected.stops >= 0) {
    filters.push(`stops=${selected.stops}`);
  }
  const fs = filters.length ? `&fs=${filters.join(";")}` : "";
  return `https://www.kayak.com/flights/${seg}${cabin}${pax}?sort=price_a${fs}`;
}
