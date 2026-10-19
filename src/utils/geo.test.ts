import { formatKm, haversineKm, kmFromDriver, pointOf } from "./geo";

const union = { lat: 43.6453, lng: -79.3806 }; // Union Station, Toronto
const pearson = { lat: 43.6777, lng: -79.6248 }; // Pearson T1

describe("haversineKm", () => {
  it("Union Station → Pearson is about 20 km", () => {
    const km = haversineKm(union, pearson);
    expect(km).toBeGreaterThan(19);
    expect(km).toBeLessThan(21);
  });
  it("same point is 0", () => {
    expect(haversineKm(union, union)).toBe(0);
  });
});

describe("pointOf / kmFromDriver", () => {
  it("rejects missing, non-numeric and 0,0 points", () => {
    expect(pointOf(undefined)).toBeNull();
    expect(pointOf({ lat: 0, lng: 0 })).toBeNull();
    expect(pointOf({ lat: Number.NaN, lng: 1 })).toBeNull();
    expect(pointOf({ lat: "43.6" as unknown as number, lng: "-79.4" as unknown as number })).toEqual({
      lat: 43.6,
      lng: -79.4,
    });
  });
  it("returns null when the driver's position is unknown", () => {
    expect(kmFromDriver(null, pearson)).toBeNull();
    expect(kmFromDriver(union, { address: "x" } as never)).toBeNull();
    expect(kmFromDriver(union, pearson)).toBeCloseTo(haversineKm(union, pearson), 6);
  });
});

describe("formatKm", () => {
  it("one decimal under 10, whole above", () => {
    expect(formatKm(0.84)).toBe("0.8 km");
    expect(formatKm(3.26)).toBe("3.3 km");
    expect(formatKm(14.4)).toBe("14 km");
    expect(formatKm(Number.NaN)).toBe("—");
  });
});
