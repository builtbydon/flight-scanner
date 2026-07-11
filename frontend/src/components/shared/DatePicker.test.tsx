import { render, screen, fireEvent } from "@testing-library/react";
import { DatePicker } from "pandora-components-web";

describe("DatePicker", () => {
  it("commits a typed date and rejects dates before min", () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} min="2026-01-01" />);
    const input = screen.getByPlaceholderText("Type or pick a date");

    fireEvent.change(input, { target: { value: "2026-06-15" } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith("2026-06-15");

    onChange.mockClear();
    fireEvent.change(input, { target: { value: "2020-01-01" } }); // before min
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens a calendar popover on the open-calendar button", () => {
    render(<DatePicker value="" onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText("Open calendar"));
    expect(screen.getByText("Su")).toBeInTheDocument();
  });

  it("moves the calendar forwards and backwards by month", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-07-15" onChange={onChange} min="2026-01-01" />);

    fireEvent.click(screen.getByLabelText("Open calendar"));
    expect(screen.getByText("July 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("August 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
