import { describe, expect, it } from "vitest";
import type { FlightResult } from "../api";
import { sortFlightResults } from "./ResultsList";

function result(id: string, priceValue: number, durationMinutes: number, isBest = false): FlightResult {
  return {
    id,
    airlines: ["Test Air"],
    airlineCodes: ["TA"],
    stops: 0,
    durationMinutes,
    durationText: `${durationMinutes}m`,
    priceText: `$${priceValue}`,
    priceValue,
    departure: "8:00 AM",
    arrival: "9:00 AM",
    arrivalTimeAhead: "",
    isBest,
    legs: [],
    layovers: [],
    legsDetailed: true,
    dealLevel: "typical",
    dealReason: "Test",
  };
}

describe("sortFlightResults", () => {
  it("puts the best visible result first by default", () => {
    const sorted = sortFlightResults([
      result("raw-first", 100, 90, false),
      result("visible-first", 300, 180, true),
    ]);

    expect(sorted.map((r) => r.id)).toEqual(["visible-first", "raw-first"]);
  });
});
