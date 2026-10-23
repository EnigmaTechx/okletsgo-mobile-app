import { completionFields } from "./driverService";
import type { RideRequest } from "../interfaces/ride";

const ride = {
  id: "r1",
  distance: 8.6,
  estimatedPrice: 8.7,
  driverStartLocation: { lat: 43.45, lng: -80.49 },
  pickup: { address: "A", lat: 43.46, lng: -80.49 },
  destination: { address: "B", lat: 43.5, lng: -80.5 },
} as unknown as RideRequest;

describe("completionFields", () => {
  it("adds the commute to the pickup on a normal completion", () => {
    const f = completionFields(ride, undefined, "2026-10-22T20:00:00.000Z");
    expect(f.tripCompletedAt).toBe("2026-10-22T20:00:00.000Z");
    expect(f.totalKmTravelled as number).toBeGreaterThan(8.6);
    expect(f.totalKmTravelled as number).toBeLessThan(10.5);
    expect(f).not.toHaveProperty("endedEarly");
  });

  it("reprices an early end, never above the booked fare", () => {
    const f = completionFields(
      ride,
      { actualDistanceKm: 3.333, earlyEndReason: "Client exited the vehicle" },
      "2026-10-22T20:00:00.000Z",
    );
    expect(f.actualDistanceKm).toBe(3.33);
    expect(f.endedEarly).toBe(true);
    expect(f.estimatedPrice as number).toBeLessThanOrEqual(8.7);
    expect(f.totalClientCharge as number).toBeCloseTo(
      (f.estimatedPrice as number) + 1.5,
      2,
    );
  });
});
