import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchForm } from "./SearchForm";
import * as api from "../api";

vi.mock("../api", () => ({ searchAirports: vi.fn() }));

const opt = (iata: string, city: string): api.AirportOption => ({
  iata, name: `${city} Airport`, city, country: "US", lat: 0, lon: 0, label: `${city} (${iata})`,
});

beforeEach(() => {
  vi.mocked(api.searchAirports).mockReset().mockResolvedValue([opt("SEA", "Seattle")]);
});

async function pickAirport(label: string, iata: string) {
  const field = screen.getByText(label).parentElement!;
  const input = field.querySelector("input")!;
  fireEvent.change(input, { target: { value: iata.toLowerCase() } });
  const option = await screen.findAllByText(/Seattle|Tokyo/);
  fireEvent.mouseDown(option[0]);
}

describe("SearchForm validation", () => {
  it("clears a stale return date when departure moves past it (no reversed range)", async () => {
    // Far-future dates so the picker's "no past dates" min never interferes,
    // regardless of the machine clock when the test runs.
    const onSearch = vi.fn();
    vi.mocked(api.searchAirports).mockImplementation(async (q) =>
      q.toLowerCase().startsWith("s") ? [opt("SEA", "Seattle")] : [opt("NRT", "Tokyo")],
    );
    render(<SearchForm onSearch={onSearch} loading={false} />);

    // Valid, distinct airports so submit reaches the date checks.
    const from = screen.getByText("From").parentElement!.querySelector("input")!;
    fireEvent.change(from, { target: { value: "sea" } });
    fireEvent.mouseDown(await screen.findByText("Seattle"));
    const to = screen.getByText("To").parentElement!.querySelector("input")!;
    fireEvent.change(to, { target: { value: "nrt" } });
    fireEvent.mouseDown(await screen.findByText("Tokyo"));

    const dateInputs = screen.getAllByPlaceholderText("Type or pick a date");
    const [depart, ret] = dateInputs;

    fireEvent.change(depart, { target: { value: "2099-08-05" } });
    fireEvent.blur(depart);
    fireEvent.change(ret, { target: { value: "2099-08-10" } });
    fireEvent.blur(ret);
    expect((ret as HTMLInputElement).value).toContain("Aug 10");

    // Move departure after the chosen return — the return must be cleared,
    // not silently submitted as a reversed date range.
    fireEvent.change(depart, { target: { value: "2099-08-20" } });
    fireEvent.blur(depart);
    await waitFor(() => expect((ret as HTMLInputElement).value).toBe(""));

    // And submit is blocked because the return is now empty.
    fireEvent.click(screen.getByRole("button", { name: /Scan flights/i }));
    expect(await screen.findByText(/Pick a return date/i)).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("blocks submitting when an airport was typed but never selected", async () => {
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} loading={false} />);
    const from = screen.getByText("From").parentElement!.querySelector("input")!;
    fireEvent.change(from, { target: { value: "tokyo" } }); // free text, no pick

    fireEvent.click(screen.getByRole("button", { name: /Scan flights/i }));
    expect(await screen.findByText(/Pick an origin and destination/i)).toBeInTheDocument();
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("submits the selected max-stops filter with the search payload", async () => {
    const onSearch = vi.fn();
    vi.mocked(api.searchAirports).mockImplementation(async (q) =>
      q.toLowerCase().startsWith("s") ? [opt("SEA", "Seattle")] : [opt("NRT", "Tokyo")],
    );
    render(<SearchForm onSearch={onSearch} loading={false} />);

    const from = screen.getByText("From").parentElement!.querySelector("input")!;
    fireEvent.change(from, { target: { value: "sea" } });
    fireEvent.mouseDown(await screen.findByText("Seattle"));
    const to = screen.getByText("To").parentElement!.querySelector("input")!;
    fireEvent.change(to, { target: { value: "nrt" } });
    fireEvent.mouseDown(await screen.findByText("Tokyo"));

    fireEvent.click(screen.getByText("One way"));
    const depart = screen.getAllByPlaceholderText("Type or pick a date")[0];
    fireEvent.change(depart, { target: { value: "2099-08-20" } });
    fireEvent.blur(depart);
    fireEvent.change(screen.getByLabelText("Num stops"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /Scan flights/i }));

    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "SEA",
        destination: "NRT",
        maxStops: 0,
      }),
    );
  });

  it("reports max-stops changes immediately for client-side filtering", () => {
    const onMaxStopsChange = vi.fn();
    render(<SearchForm onSearch={vi.fn()} loading={false} onMaxStopsChange={onMaxStopsChange} />);

    fireEvent.change(screen.getByLabelText("Num stops"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Num stops"), { target: { value: "" } });

    expect(onMaxStopsChange).toHaveBeenNthCalledWith(1, 1);
    expect(onMaxStopsChange).toHaveBeenNthCalledWith(2, null);
  });

  it("submits the selected airline filter with the search payload", async () => {
    const onSearch = vi.fn();
    vi.mocked(api.searchAirports).mockImplementation(async (q) =>
      q.toLowerCase().startsWith("s") ? [opt("SEA", "Seattle")] : [opt("NRT", "Tokyo")],
    );
    render(<SearchForm onSearch={onSearch} loading={false} />);

    const from = screen.getByText("From").parentElement!.querySelector("input")!;
    fireEvent.change(from, { target: { value: "sea" } });
    fireEvent.mouseDown(await screen.findByText("Seattle"));
    const to = screen.getByText("To").parentElement!.querySelector("input")!;
    fireEvent.change(to, { target: { value: "nrt" } });
    fireEvent.mouseDown(await screen.findByText("Tokyo"));

    fireEvent.click(screen.getByText("One way"));
    const depart = screen.getAllByPlaceholderText("Type or pick a date")[0];
    fireEvent.change(depart, { target: { value: "2099-08-20" } });
    fireEvent.blur(depart);
    fireEvent.change(screen.getByLabelText("Airline"), { target: { value: "JL" } });
    fireEvent.click(screen.getByRole("button", { name: /Scan flights/i }));

    await waitFor(() => expect(onSearch).toHaveBeenCalledTimes(1));
    expect(onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "SEA",
        destination: "NRT",
        airlineCode: "JL",
      }),
    );
  });
});
