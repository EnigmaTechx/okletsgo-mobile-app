import {
  cleanPredictionAddress,
  durationLabel,
  firstLine,
  isSamePlace,
  splitAddress,
  timeParts,
} from "./address";

describe("address helpers", () => {
  it("takes the street line and splits the rest", () => {
    expect(firstLine("133 Weber St N, Waterloo, ON")).toBe("133 Weber St N");
    expect(splitAddress("133 Weber St N, Waterloo, ON")).toEqual({
      main: "133 Weber St N",
      sub: "Waterloo, ON",
    });
    expect(splitAddress("Just one part")).toEqual({
      main: "Just one part",
      sub: "",
    });
  });

  it("stores the first two segments of a prediction", () => {
    expect(
      cleanPredictionAddress("Fairview Park Mall, Kitchener, ON, Canada"),
    ).toBe("Fairview Park Mall, Kitchener");
    expect(cleanPredictionAddress("1 King St, Kitchener, ON, Canada", 3)).toBe(
      "1 King St, Kitchener, ON",
    );
  });

  it("flags identical pickup and drop-off", () => {
    const a = { address: "A", lat: 43.1, lng: -80.1 };
    expect(isSamePlace(a, { ...a })).toBe(true);
    expect(isSamePlace(a, { address: " a ", lat: 1, lng: 1 })).toBe(true);
    expect(isSamePlace(a, { address: "B", lat: 43.2, lng: -80.1 })).toBe(false);
  });

  it("formats times defensively", () => {
    expect(timeParts("not a date")).toEqual(["—", ""]);
    const [t, ampm] = timeParts("2026-10-21T18:10:00");
    expect(t).toMatch(/^\d{1,2}:\d{2}$/);
    expect(["AM", "PM"]).toContain(ampm);
    expect(durationLabel("2026-10-21T18:00:00Z", "2026-10-21T18:12:00Z")).toBe(
      "12 min",
    );
    expect(durationLabel("2026-10-21T18:00:00Z", "2026-10-21T19:05:00Z")).toBe(
      "1h 05m",
    );
    expect(durationLabel(null, "2026-10-21T19:05:00Z")).toBeNull();
  });
});
