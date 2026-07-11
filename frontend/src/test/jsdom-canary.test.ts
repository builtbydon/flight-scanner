describe("jsdom canary", () => {
  it("starts a DOM-backed Vitest environment", () => {
    const el = document.createElement("button");
    el.textContent = "ready";
    document.body.appendChild(el);

    expect(document.querySelector("button")).toHaveTextContent("ready");
  });
});
