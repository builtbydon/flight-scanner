import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ToastProvider } from "pandora-components-web";
import App from "./App";
import * as api from "./api";
import type { FlightResult, SearchResponse } from "./api";

vi.mock("pandora-components-web/globe", () => ({
  GeoGlobe: () => <div data-testid="geo-globe" />,
}));

vi.mock("./api", async () => {
  const actual = await vi.importActual<typeof import("./api")>("./api");
  return {
    ...actual,
    getDestination: vi.fn().mockResolvedValue(null),
    searchAirports: vi.fn(),
    searchFlights: vi.fn(),
  };
});

const airport = (iata: string, city: string): api.AirportOption => ({
  iata,
  name: `${city} Airport`,
  city,
  country: "US",
  lat: 0,
  lon: 0,
  label: `${city} (${iata})`,
});

const result = (overrides: Partial<FlightResult>): FlightResult => ({
  id: "result",
  airlines: ["Test Air"],
  airlineCodes: ["TA"],
  stops: 0,
  durationMinutes: 600,
  durationText: "10 hr",
  priceText: "$500",
  priceValue: 500,
  departure: "9:00 AM",
  arrival: "7:00 PM",
  arrivalTimeAhead: "",
  isBest: false,
  legs: [],
  layovers: [],
  legsDetailed: true,
  dealLevel: "typical",
  dealReason: "Test fixture",
  ...overrides,
});

const searchResponse = (): SearchResponse => ({
  source: "mock",
  priceLevel: "low",
  query: {
    origin: "SEA",
    destination: "NRT",
    originCity: "Seattle",
    destinationCity: "Tokyo",
    departDate: "2099-08-20",
    returnDate: null,
    trip: "one-way",
    seat: "economy",
    adults: 1,
    maxStops: null,
    airlineCode: null,
  },
  results: [
    result({
      id: "nonstop",
      airlines: ["Delta Air Lines"],
      airlineCodes: ["DL"],
      stops: 0,
      durationText: "10 hr 15 min",
      priceText: "$640",
      priceValue: 640,
      isBest: false,
    }),
    result({
      id: "two-stop",
      airlines: ["Frontier Airlines", "Japan Airlines"],
      airlineCodes: ["F9", "JL"],
      stops: 2,
      durationText: "18 hr 15 min",
      priceText: "$1234",
      priceValue: 1234,
      isBest: true,
    }),
  ],
});

async function chooseAirport(label: string, typed: string, option: string) {
  const input = screen.getByText(label).parentElement!.querySelector("input")!;
  fireEvent.change(input, { target: { value: typed } });
  fireEvent.mouseDown(await screen.findByText(option));
}

describe("App result filtering", () => {
  beforeEach(() => {
    vi.mocked(api.searchAirports).mockImplementation(async (q) =>
      q.toLowerCase().startsWith("s") ? [airport("SEA", "Seattle")] : [airport("NRT", "Tokyo")],
    );
    vi.mocked(api.searchFlights).mockReset().mockResolvedValue(searchResponse());
    vi.mocked(api.getDestination).mockReset().mockResolvedValue(null);
  });

  it("filters already rendered results when num stops changes without re-searching", async () => {
    render(
      <ToastProvider>
        <App />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByText("One way"));
    await chooseAirport("From", "sea", "Seattle");
    await chooseAirport("To", "nrt", "Tokyo");
    const depart = screen.getAllByPlaceholderText("Type or pick a date")[0];
    fireEvent.change(depart, { target: { value: "2099-08-20" } });
    fireEvent.blur(depart);
    fireEvent.click(screen.getByRole("button", { name: /Scan flights/i }));

    await screen.findByText("Frontier Airlines, Japan Airlines");
    expect(screen.getByText("18 hr 15 min · 2 stops")).toBeInTheDocument();
    expect(api.searchFlights).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Num stops"), { target: { value: "0" } });

    await waitFor(() => {
      expect(screen.queryByText("Frontier Airlines, Japan Airlines")).not.toBeInTheDocument();
    });
    expect(screen.getByText("Delta Air Lines")).toBeInTheDocument();
    expect(screen.getByText("10 hr 15 min · Nonstop")).toBeInTheDocument();
    expect(api.searchFlights).toHaveBeenCalledTimes(1);
  });
});
