import { describe, it, expect } from "vitest";
import { googleFlightsUrl, kayakUrl } from "./booking";

const base = {
  origin: "SEA",
  destination: "NRT",
  departDate: "2026-08-01",
  returnDate: "2026-08-15",
  trip: "round-trip",
  seat: "economy",
  adults: 1,
};

describe("kayakUrl", () => {
  it("uses Kayak's real cabin token for premium economy (not 'premiumeconomy')", () => {
    const url = kayakUrl({ ...base, seat: "premium-economy" });
    expect(url).toContain("/premium");
    expect(url).not.toContain("premiumeconomy");
  });

  it("maps business/first to their cabin tokens and omits the token for economy", () => {
    expect(kayakUrl({ ...base, seat: "business" })).toContain("/business");
    expect(kayakUrl({ ...base, seat: "first" })).toContain("/first");
    const eco = kayakUrl({ ...base, seat: "economy" });
    expect(eco).not.toMatch(/\/(premium|business|first)/);
  });

  it("encodes the passenger count when more than one adult", () => {
    expect(kayakUrl({ ...base, adults: 2 })).toContain("/2adults");
    // A single adult stays implicit (Kayak defaults to 1).
    expect(kayakUrl({ ...base, adults: 1 })).not.toContain("adults");
  });

  it("includes both dates for round trips and only depart for one-way", () => {
    expect(kayakUrl(base)).toContain("2026-08-01/2026-08-15");
    const ow = kayakUrl({ ...base, trip: "one-way", returnDate: null });
    expect(ow).toContain("SEA-NRT/2026-08-01");
    expect(ow).not.toContain("2026-08-15");
  });

  it("stays an unfiltered search when no flight is selected", () => {
    expect(kayakUrl(base)).not.toContain("fs=");
  });

  it("filters to the selected flight's airline and stops", () => {
    const url = kayakUrl(base, { airlineCodes: ["B6"], stops: 0 });
    expect(url).toContain("fs=airlines=B6;stops=0");
  });

  it("includes every airline code for a codeshare and dedups/normalizes them", () => {
    const url = kayakUrl(base, { airlineCodes: ["dl", "DL", "aa"], stops: 1 });
    expect(url).toContain("airlines=DL,AA");
    expect(url).toContain("stops=1");
  });

  it("drops non-IATA airline codes rather than emitting a broken filter", () => {
    // A bogus code alone -> no airlines clause; stops still applies.
    const url = kayakUrl(base, { airlineCodes: ["Delta"], stops: 0 });
    expect(url).not.toContain("airlines=");
    expect(url).toContain("fs=stops=0");
  });
});

describe("googleFlightsUrl", () => {
  it("says 'one way' for one-way trips so Google doesn't assume a round trip", () => {
    const url = googleFlightsUrl({ ...base, trip: "one-way", returnDate: null });
    expect(decodeURIComponent(url)).toContain("one way");
  });

  it("includes the return date phrase for round trips", () => {
    expect(decodeURIComponent(googleFlightsUrl(base))).toContain("returning 2026-08-15");
  });

  it("includes the stops cap in the fallback Google search phrase", () => {
    expect(decodeURIComponent(googleFlightsUrl({ ...base, maxStops: 0 }))).toContain("nonstop");
    expect(decodeURIComponent(googleFlightsUrl({ ...base, maxStops: 1 }))).toContain("1 stop or fewer");
  });

  it("includes the airline code in the fallback Google search phrase", () => {
    expect(decodeURIComponent(googleFlightsUrl({ ...base, airlineCode: "JL" }))).toContain("JL");
  });
});
