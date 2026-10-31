import { dispatcherFor } from "./dispatch";

describe("dispatcherFor", () => {
  const cfg = { enabled: true, dispatcherId: "andy", testDispatcherId: "tst" };
  it("picks the live or the test dispatcher", () => {
    expect(dispatcherFor(cfg, false)).toBe("andy");
    expect(dispatcherFor(cfg, true)).toBe("tst");
  });
  it("is null when dispatch is off or no dispatcher is set", () => {
    expect(dispatcherFor({ ...cfg, enabled: false }, false)).toBeNull();
    expect(dispatcherFor({ enabled: true }, false)).toBeNull();
    expect(
      dispatcherFor({ enabled: true, dispatcherId: "andy" }, true),
    ).toBeNull();
    expect(dispatcherFor(null, false)).toBeNull();
  });
});
