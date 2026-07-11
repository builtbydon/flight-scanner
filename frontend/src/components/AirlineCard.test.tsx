import { render, screen, waitFor } from "@testing-library/react";
import { AirlineCard } from "./AirlineCard";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AirlineCard", () => {
  it("renders the final experience details after the airline API settles", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "BA",
        name: "British Airways",
        region: "Europe",
        seatPitchInches: "31",
        checkedBagFee: "Included on most long-haul fares",
        carryOnIncluded: true,
        carryOnDimensions: "22 × 18 × 10 in (56 × 45 × 25 cm), max 51 lb / 23 kg",
        freeSnacks: "Meals on long-haul flights",
        wifi: "Available on many aircraft",
        seatPower: "USB or AC on many long-haul aircraft",
        notes: "Large Heathrow network.",
      }),
    } as Response);

    render(<AirlineCard code="BA" />);

    expect(screen.getByText(/Loading BA/)).toBeInTheDocument();
    expect(await screen.findByText("British Airways")).toBeInTheDocument();
    expect(screen.getByText("Seat pitch (legroom)")).toBeInTheDocument();
    expect(screen.getByText("31″")).toBeInTheDocument();
    expect(screen.getByText("Carry-on included")).toBeInTheDocument();
    expect(screen.getByText("Yes ✓")).toBeInTheDocument();
    expect(screen.getByText("Carry-on size")).toBeInTheDocument();
    expect(screen.getByText("22 × 18 × 10 in (56 × 45 × 25 cm), max 51 lb / 23 kg")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Loading BA/)).not.toBeInTheDocument());
  });

  it("renders the no-data state after a 404 settles", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 404,
      ok: false,
      json: async () => ({ detail: "No curated data" }),
    } as Response);

    render(<AirlineCard code="ZZ" />);

    expect(await screen.findByText("ZZ")).toBeInTheDocument();
    expect(screen.getByText("No curated experience data for this airline yet.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Loading ZZ/)).not.toBeInTheDocument());
  });
});
