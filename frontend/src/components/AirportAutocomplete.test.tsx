import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AirportAutocomplete } from "./AirportAutocomplete";
import * as api from "../api";

vi.mock("../api", () => ({
  searchAirports: vi.fn(),
}));

const seattle: api.AirportOption = {
  iata: "SEA",
  name: "Seattle-Tacoma International Airport",
  city: "Seattle",
  country: "United States",
  lat: 47.4,
  lon: -122.3,
  label: "Seattle (SEA)",
};

beforeEach(() => {
  vi.mocked(api.searchAirports).mockReset().mockResolvedValue([seattle]);
});

describe("AirportAutocomplete", () => {
  it("reports no code for free-typed text (so bogus 3-letter codes can't slip through)", () => {
    const onSelect = vi.fn();
    render(<AirportAutocomplete label="From" onSelect={onSelect} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "tokyo" } });
    // Every keystroke reports "" until a real suggestion is chosen.
    expect(onSelect).toHaveBeenLastCalledWith("");
  });

  it("reports the IATA code and shows the display label after a real selection", async () => {
    const onSelect = vi.fn();
    render(<AirportAutocomplete label="From" onSelect={onSelect} />);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "sea" } });

    const option = await screen.findByText("Seattle");
    fireEvent.mouseDown(option);

    expect(onSelect).toHaveBeenLastCalledWith("SEA");
    // The typed prefix is not clobbered by the code being echoed back.
    await waitFor(() => expect(input.value).toBe("Seattle (SEA)"));
  });
});
