import { buildDriverStats, rideEarned } from "./driverStatsService";
import { driverPayout } from "../utils/fareCalculator";
import type { RideRequest } from "../interfaces/ride";

// Wednesday 2026-09-16 at noon local time.
const NOW = new Date(2026, 8, 16, 12, 0, 0);

const ride = (over: Partial<RideRequest>): RideRequest =>
  ({
    id: Math.random().toString(36).slice(2),
    clientId: "c",
    driverId: "d",
    status: "completed",
    estimatedPrice: 50,
    distance: 10,
    scheduledTime: NOW.toISOString(),
    createdAt: NOW.toISOString(),
    ...over,
  }) as unknown as RideRequest;

const at = (y: number, m: number, d: number, h = 10) =>
  new Date(y, m, d, h).toISOString();

const pay = (...fares: number[]) =>
  fares.reduce((s, f) => s + driverPayout(f), 0);

describe("rideEarned", () => {
  it("prefers the stored payout, else the driver's share", () => {
    expect(rideEarned(ride({ driverPayout: 12.34 }))).toBe(12.34);
    expect(rideEarned(ride({ estimatedPrice: 100 }))).toBe(driverPayout(100));
    expect(rideEarned(ride({ status: "cancelled", cancellationFee: 20 }))).toBe(
      driverPayout(20),
    );
    expect(rideEarned(ride({ status: "cancelled" }))).toBe(0);
  });
});

describe("buildDriverStats", () => {
  const rides: RideRequest[] = [
    // this week (Mon 14th, Tue 15th)
    ride({ completedAt: at(2026, 8, 14), estimatedPrice: 40, distance: 8 }),
    ride({
      completedAt: at(2026, 8, 15),
      estimatedPrice: 60,
      actualDistanceKm: 5,
      distance: 12,
    }),
    // earlier this month (Sep 3rd) — "Wk 1"
    ride({ completedAt: at(2026, 8, 3), estimatedPrice: 100, distance: 20 }),
    // a no-show fee this month (Sep 10th) — "Wk 2"
    ride({
      status: "cancelled",
      cancelledAt: at(2026, 8, 10),
      cancellationFee: 30,
      estimatedPrice: 90,
    }),
    // last month (Aug)
    ride({ completedAt: at(2026, 7, 20), estimatedPrice: 80, distance: 15 }),
    // way back (Jan) — lifetime only
    ride({ completedAt: at(2026, 0, 5), estimatedPrice: 20, distance: 4 }),
  ];

  it("week: counts Mon/Tue rides and buckets earnings per day", () => {
    const s = buildDriverStats("week", rides, NOW);
    expect(s.rides).toBe(2);
    expect(s.km).toBe(8 + 5); // actualDistanceKm wins when set
    expect(s.earned).toBeCloseTo(pay(40, 60), 2);
    expect(s.perRide).toBeCloseTo(pay(40, 60) / 2, 2);
    expect(s.bars.map((b) => b.label)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(s.bars[0].value).toBeCloseTo(pay(40), 2);
    expect(s.bars[1].value).toBeCloseTo(pay(60), 2);
    expect(s.bars[2].value).toBe(0);
    expect(s.periodLabel).toBe("this week");
  });

  it("month: includes the cancellation fee and separates it", () => {
    const s = buildDriverStats("month", rides, NOW);
    expect(s.rides).toBe(3);
    expect(s.cancellationEarnings).toBeCloseTo(pay(30), 2);
    expect(s.earned).toBeCloseTo(pay(40, 60, 100, 30), 2);
    // perRide only counts completed rides
    expect(s.perRide).toBeCloseTo(pay(40, 60, 100) / 3, 2);
    expect(s.chartTitle).toBe("Earnings per week");
    expect(s.bars[0].value).toBeCloseTo(pay(100), 2); // Sep 1–7
    expect(s.bars[1].value).toBeCloseTo(pay(30, 40), 2); // Sep 8–14
    expect(s.bars[2].value).toBeCloseTo(pay(60), 2); // Sep 15–21
  });

  it("six months: one bar per month, oldest first; January is excluded", () => {
    const s = buildDriverStats("all", rides, NOW);
    expect(s.bars).toHaveLength(6);
    expect(s.bars[0].label).toBe(
      new Date(2026, 3, 1).toLocaleDateString(undefined, { month: "short" }),
    );
    expect(s.rides).toBe(4); // Sep ×3 + Aug, not Jan
    expect(s.bars[4].value).toBeCloseTo(pay(80), 2); // Aug
    expect(s.bars[5].value).toBeCloseTo(pay(40, 60, 100, 30), 2); // Sep
    expect(s.periodLabel).toBe("the last 6 months");
  });

  it("lifetime covers every ride regardless of period", () => {
    const s = buildDriverStats("week", rides, NOW);
    expect(s.lifetime.rides).toBe(5);
    expect(s.lifetime.km).toBe(8 + 5 + 20 + 15 + 4);
    expect(s.lifetime.earned).toBeCloseTo(pay(40, 60, 100, 30, 80, 20), 2);
  });

  it("empty input is all zeros, not NaN", () => {
    const s = buildDriverStats("month", [], NOW);
    expect(s.earned).toBe(0);
    expect(s.perRide).toBe(0);
    expect(s.lifetime.earned).toBe(0);
    expect(s.bars.every((b) => b.value === 0)).toBe(true);
  });
});
