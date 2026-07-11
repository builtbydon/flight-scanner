import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DestinationPanel } from "./DestinationPanel";
import * as api from "../api";

vi.mock("../api", () => ({
  getDestination: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(api.getDestination).mockReset().mockResolvedValue({
    iata: "NRT",
    city: "Tokyo",
    country: "Japan",
    summary: "A dense city with many distinct districts.",
    wikivoyageUrl: "https://en.wikivoyage.org/wiki/Tokyo",
    thumbnail: "",
    cached: false,
    attractions: [
      {
        name: "Tokyo National Museum",
        type: "attraction",
        distKm: 2.4,
        url: "https://en.wikipedia.org/?curid=309303",
      },
    ],
  });
});

describe("DestinationPanel", () => {
  it("renders destination attractions as final clickable source links", async () => {
    render(<DestinationPanel iata="NRT" city="Tokyo" />);

    expect(screen.getByText(/Loading things to do in Tokyo/)).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: /Tokyo National Museum/i });

    expect(link).toHaveAttribute("href", "https://en.wikipedia.org/?curid=309303");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText("2.4 km")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/Loading things to do in Tokyo/)).not.toBeInTheDocument());
  });
});
