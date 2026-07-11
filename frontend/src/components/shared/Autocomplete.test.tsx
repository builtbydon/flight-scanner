import { render, screen, fireEvent } from "@testing-library/react";
import { Autocomplete } from "pandora-components-web";

describe("Autocomplete", () => {
  it("debounced-fetches options and reports the chosen one on select", async () => {
    const fetchOptions = vi.fn().mockResolvedValue([
      { id: "SEA", label: "Seattle", sublabel: "Sea-Tac", displayValue: "Seattle (SEA)" },
    ]);
    const onSelect = vi.fn();
    render(<Autocomplete value="" debounceMs={0} fetchOptions={fetchOptions} onSelect={onSelect} />);

    const input = screen.getByRole("textbox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "sea" } });

    const opt = await screen.findByText("Seattle");
    fireEvent.mouseDown(opt);

    expect(fetchOptions).toHaveBeenCalledWith("sea");
    expect(onSelect.mock.calls.some((c) => c[0]?.id === "SEA")).toBe(true);
    expect((input as HTMLInputElement).value).toBe("Seattle (SEA)");
  });
});
