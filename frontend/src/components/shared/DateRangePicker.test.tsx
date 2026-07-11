import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { DateRangePicker } from "./DateRangePicker";

function ControlledRange({
  initialDepart = "",
  initialReturn = "",
  isRoundTrip = true,
}: {
  initialDepart?: string;
  initialReturn?: string;
  isRoundTrip?: boolean;
}) {
  const [departDate, setDepartDate] = useState(initialDepart);
  const [returnDate, setReturnDate] = useState(initialReturn);
  return (
    <DateRangePicker
      departDate={departDate}
      returnDate={returnDate}
      onDepartChange={setDepartDate}
      onReturnChange={setReturnDate}
      min="2026-07-01"
      isRoundTrip={isRoundTrip}
    />
  );
}

describe("DateRangePicker", () => {
  it("keeps the calendar open after departure selection and then commits the return date", () => {
    render(<ControlledRange />);

    fireEvent.click(screen.getByLabelText("Open calendar for departure"));
    fireEvent.click(screen.getByRole("button", { name: "15" }));

    expect((screen.getByPlaceholderText("Depart date") as HTMLInputElement).value).toContain("Jul 15");
    expect(screen.getByText("Now select a return date")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "22" }));
    expect((screen.getByPlaceholderText("Return date") as HTMLInputElement).value).toContain("Jul 22");
    expect(screen.queryByText("Now select a return date")).not.toBeInTheDocument();
  });

  it("clears an existing return date when the new departure is after it", () => {
    render(<ControlledRange initialDepart="2026-07-10" initialReturn="2026-07-20" />);

    expect((screen.getByPlaceholderText("Return date") as HTMLInputElement).value).toContain("Jul 20");
    fireEvent.click(screen.getByLabelText("Open calendar for departure"));
    fireEvent.click(screen.getByRole("button", { name: "25" }));

    expect((screen.getByPlaceholderText("Depart date") as HTMLInputElement).value).toContain("Jul 25");
    expect(screen.getByPlaceholderText("Return date")).toHaveValue("");
  });

  it("disables return selection for one-way trips", () => {
    render(<ControlledRange isRoundTrip={false} />);

    expect(screen.getByPlaceholderText("Return date")).toBeDisabled();
    expect(screen.getByLabelText("Open calendar for return")).toBeDisabled();
  });

  it("moves the visible month forwards and backwards", () => {
    render(<ControlledRange initialDepart="2026-07-15" />);

    fireEvent.click(screen.getByLabelText("Open calendar for departure"));
    expect(screen.getByText("July 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByText("August 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });
});
