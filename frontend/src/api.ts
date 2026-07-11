// Typed client for the Flight Scanner backend.

export interface AirportOption {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  label: string;
}

export interface Leg {
  from: string;
  to: string;
  fromName: string;
  toName: string;
  fromCity: string;
  toCity: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  airlineCode: string;
  airline: string;
  flightNumber: string;
  aircraft: string;
  durationMinutes: number;
  durationText: string;
}

export interface Layover {
  airport: string;
  name: string;
  city: string;
  durationMinutes: number;
  durationText: string;
  short: boolean;
  long: boolean;
}

export type DealLevel = "low" | "typical" | "high" | "unknown";

export interface FlightResult {
  id: string;
  airlines: string[];
  airlineCodes: string[];
  stops: number;
  durationMinutes: number | null;
  durationText: string;
  priceText: string;
  priceValue: number | null;
  departure: string;
  arrival: string;
  arrivalTimeAhead: string;
  isBest: boolean;
  legs: Leg[];
  layovers: Layover[];
  legsDetailed: boolean;
  estimated?: boolean;
  bookingUrl?: string | null;
  dealLevel: DealLevel;
  dealReason: string;
  googleDeal?: DealLevel;
}

export interface SearchResponse {
  source: string;
  priceLevel: DealLevel | null;
  results: FlightResult[];
  query: {
    origin: string;
    destination: string;
    originCity: string;
    destinationCity: string;
    departDate: string;
    returnDate: string | null;
    trip: string;
    seat: string;
    adults: number;
    maxStops: number | null;
    airlineCode: string | null;
  };
  notice?: string;
  cached?: boolean;
  bookingUrl?: string | null;
  returnItinerary?: ReturnItinerary | null;
}

// The return direction is scraped route/times/layovers only — Google bundles
// round-trip pricing, so the backend strips price fields, never runs deal
// classification on it, and the mock path leaves it without an id. Model those
// as absent so callers must guard before reading them.
export type ReturnItinerary = Omit<
  FlightResult,
  "id" | "priceText" | "priceValue" | "dealLevel" | "dealReason"
> &
  Partial<Pick<FlightResult, "id" | "priceText" | "priceValue" | "dealLevel" | "dealReason">>;

export interface AirlineCardData {
  code: string;
  name: string;
  region: string;
  seatPitchInches: string;
  checkedBagFee: string;
  carryOnIncluded: boolean;
  carryOnDimensions?: string;
  freeSnacks: string;
  wifi: string;
  seatPower: string;
  notes: string;
}

export interface SearchParams {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string | null;
  trip: "one-way" | "round-trip";
  seat: string;
  adults: number;
  maxStops?: number | null;
  airlineCode?: string | null;
}

const apiPath = (path: string) => {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

async function jsonOrThrow(res: Response) {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const d = (await res.json()).detail;
      if (typeof d === "string") {
        detail = d;
      } else if (Array.isArray(d)) {
        // FastAPI/Pydantic 422 validation errors come back as an array of
        // { msg, loc } objects — join their messages instead of "[object Object]".
        detail = d.map((e) => e?.msg ?? String(e)).join("; ") || detail;
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function searchAirports(q: string): Promise<AirportOption[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${apiPath("/api/airports")}?q=${encodeURIComponent(q)}`);
  const data = await jsonOrThrow(res);
  return data.results as AirportOption[];
}

export async function searchFlights(params: SearchParams): Promise<SearchResponse> {
  const res = await fetch(apiPath("/api/search"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return jsonOrThrow(res);
}

export async function getAirline(iata: string): Promise<AirlineCardData | null> {
  const res = await fetch(apiPath(`/api/airlines/${encodeURIComponent(iata)}`));
  if (res.status === 404) return null;
  return jsonOrThrow(res);
}

export interface Attraction {
  name: string;
  type: string;
  distKm?: number;
  url?: string;
}

export interface DestinationInfo {
  iata: string;
  city: string;
  country: string;
  summary: string;
  wikivoyageUrl: string;
  thumbnail: string;
  attractions: Attraction[];
  cached: boolean;
}

export async function getDestination(iata: string): Promise<DestinationInfo | null> {
  const res = await fetch(apiPath(`/api/destination/${encodeURIComponent(iata)}`));
  if (!res.ok) return null;
  return res.json();
}
