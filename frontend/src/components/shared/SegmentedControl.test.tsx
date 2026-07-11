import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedControl } from "pandora-components-web";

describe("SegmentedControl", () => {
  const opts = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
  ];

  it("marks the active option and fires onChange on click", () => {
    const onChange = vi.fn();
    render(<SegmentedControl value="a" onChange={onChange} options={opts} />);
    expect(screen.getByText("Alpha").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Beta").getAttribute("aria-selected")).toBe("false");
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
