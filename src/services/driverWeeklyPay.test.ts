import {
  buildWeekPay,
  buildWeeklyPay,
  mondayFromKey,
  weekKey,
  weekLabel,
} from "./driverStatsService";
import { driverPayout } from "../utils/fareCalculator";
import type { RideRequest } from "../interfaces/ride";

// Wednesday 2026-10-14 at noon local → this week is Mon Oct 12 – Sun Oct 18.
const NOW = new Date(2026, 9, 14, 12, 0, 0);

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

const pay = (...fares: number[]) => fares.reduce((s, f) => s + driverPayout(f), 0);

describe("week keys and labels", () => {
  it("round-trips a Monday through the key", () => {
    const monday = new Date(2026, 9, 12);
    expect(weekKey(monday)).toBe("2026-10-12");
    expect(mondayFromKey("2026-10-12")?.getTime()).toBe(monday.getTime());
    // A mid-week key snaps back to its Monday.
    expect(mondayFromKey("2026-10-15")?.getTime()).toBe(monday.getTime());
    expect(mondayFromKey("nope")).toBeNull();
  });

  it("labels same-month, cross-month and other-year weeks", () => {
    expect(weekLabel(new Date(2026, 9, 12), NOW)).toBe("Oct 12 – 18");
    expect(weekLabel(new Date(2026, 8, 28), NOW)).toBe("Sep 28 – Oct 4");
    expect(weekLabel(new Date(2025, 11, 29), NOW)).toBe("Dec 29 – Jan 4, 2025");
  });
});

describe("buildWeekPay / buildWeeklyPay", () => {
  const rides: RideRequest[] = [
    // this week
    ride({ completedAt: at(2026, 9, 12, 9), estimatedPrice: 40, distance: 8 }),
    ride({ completedAt: at(2026, 9, 14, 8), estimatedPrice: 60, actualDistanceKm: 5 }),
    ride({ status: "cancelled", cancelledAt: at(2026, 9, 13), cancellationFee: 20 }),
    // Sunday 23:59 of last week — must land in LAST week, not this one
    ride({ completedAt: new Date(2026, 9, 11, 23, 59).toISOString(), estimatedPrice: 100, distance: 20 }),
    // last week
    ride({ completedAt: at(2026, 9, 7), estimatedPrice: 30, distance: 6 }),
    // nine weeks ago — outside the default window
    ride({ completedAt: at(2026, 7, 10), estimatedPrice: 80, distance: 15 }),
  ];

  it("buckets the current week, boundaries inclusive at Monday 00:00 only", () => {
    const w = buildWeekPay(new Date(2026, 9, 12), rides, NOW);
    expect(w.key).toBe("2026-10-12");
    expect(w.current).toBe(true);
    expect(w.rides).toBe(2);
    expect(w.km).toBe(8 + 5);
    expect(w.cancellationEarnings).toBeCloseTo(pay(20), 2);
    expect(w.earned).toBeCloseTo(pay(40, 60, 20), 2);
    // newest first
    expect(w.items[0].estimatedPrice).toBe(60);
  });

  it("last week picks up the Sunday-night ride", () => {
    const w = buildWeekPay(new Date(2026, 9, 5), rides, NOW);
    expect(w.current).toBe(false);
    expect(w.rides).toBe(2);
    expect(w.earned).toBeCloseTo(pay(100, 30), 2);
  });

  it("buildWeeklyPay returns 8 weeks newest first and drops older rides", () => {
    const weeks = buildWeeklyPay(rides, NOW);
    expect(weeks).toHaveLength(8);
    expect(weeks[0].key).toBe("2026-10-12");
    expect(weeks[1].key).toBe("2026-10-05");
    expect(weeks[7].key).toBe("2026-08-24");
    const total = weeks.reduce((s, w) => s + w.earned, 0);
    expect(total).toBeCloseTo(pay(40, 60, 20, 100, 30), 2); // Aug 10 ride excluded
    expect(weeks.slice(2).every((w) => w.rides === 0)).toBe(true);
  });
});
