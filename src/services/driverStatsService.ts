import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "@react-native-firebase/firestore";
import { db } from "./firebase";
import type { RideRequest } from "../interfaces/ride";
import { driverPayout } from "../utils/fareCalculator";
import {
  bucketByPeriod,
  completedTime,
  periodStart,
  rideKm,
  startOfWeek,
  type SummaryBar,
  type SummaryPeriod,
} from "./adminStatsService";

/**
 * Data for the driver's Earnings & stats page.
 *
 * One query fetches every completed and cancelled ride for the driver (served
 * by the existing (driverId, status, createdAt) index — the same query Ride
 * History runs), and the page buckets on device for whichever period is
 * selected. Lifetime figures come from the same set, so everything on the
 * page agrees with itself.
 */

/**
 * What the driver earned on a ride — the same figure Ride History shows:
 * the stored payout when the backend recorded one (mid-trip cancellations),
 * otherwise the driver's share of the fare, or of the cancellation fee.
 */
export const rideEarned = (r: RideRequest): number => {
  if (typeof r.driverPayout === "number") return r.driverPayout;
  if (r.status === "cancelled") return driverPayout(r.cancellationFee || 0);
  if (r.status === "completed") return driverPayout(r.estimatedPrice || 0);
  return 0;
};

/** When a ride's earnings land: completion time, or cancellation time. */
export const earnedTime = (r: RideRequest): number =>
  r.status === "cancelled"
    ? new Date(r.cancelledAt ?? r.scheduledTime ?? "").getTime()
    : completedTime(r);

// ─── Weekly pay ─────────────────────────────────────────────────────────────

export interface WeekPay {
  /** "2026-10-06" — the Monday, local date; used in the URL. */
  key: string;
  start: Date;
  /** Exclusive: the following Monday 00:00. */
  end: Date;
  /** "Oct 6 – 12", "Sep 29 – Oct 5", with the year when not the current one. */
  label: string;
  /** True for the week containing `now`. */
  current: boolean;
  /** Completed rides in the week. */
  rides: number;
  km: number;
  /** Everything owed for the week: completed payouts + cancellation payouts. */
  earned: number;
  cancellationEarnings: number;
  /** The rides themselves (completed + cancelled), newest first. */
  items: RideRequest[];
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Local-date key for a week's Monday. */
export const weekKey = (monday: Date): string =>
  `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;

/** Monday 00:00 from a "YYYY-MM-DD" key; null when malformed. */
export const mondayFromKey = (key: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : startOfWeek(d);
};

export const weekLabel = (start: Date, now = new Date()): string => {
  const last = new Date(start);
  last.setDate(last.getDate() + 6);
  const mon = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  const range =
    start.getMonth() === last.getMonth()
      ? `${mon(start)} ${start.getDate()} – ${last.getDate()}`
      : `${mon(start)} ${start.getDate()} – ${mon(last)} ${last.getDate()}`;
  return start.getFullYear() === now.getFullYear()
    ? range
    : `${range}, ${start.getFullYear()}`;
};

/** Pure: one row per Monday–Sunday week, newest first. */
export const buildWeekPay = (
  start: Date,
  rides: RideRequest[],
  now = new Date(),
): WeekPay => {
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const items = rides
    .filter((r) => {
      const t = earnedTime(r);
      return !Number.isNaN(t) && t >= start.getTime() && t < end.getTime();
    })
    .sort((a, b) => earnedTime(b) - earnedTime(a));
  const completed = items.filter((r) => r.status === "completed");
  const cancelled = items.filter((r) => r.status === "cancelled");
  const cancellationEarnings = cancelled.reduce((s, r) => s + rideEarned(r), 0);
  const earned =
    completed.reduce((s, r) => s + rideEarned(r), 0) + cancellationEarnings;
  const t = now.getTime();
  return {
    key: weekKey(start),
    start,
    end,
    label: weekLabel(start, now),
    current: t >= start.getTime() && t < end.getTime(),
    rides: completed.length,
    km: completed.reduce((s, r) => s + rideKm(r), 0),
    earned: round2(earned),
    cancellationEarnings: round2(cancellationEarnings),
    items,
  };
};

/** The last `count` weeks including the current one, newest first. */
export const buildWeeklyPay = (
  rides: RideRequest[],
  now = new Date(),
  count = 8,
): WeekPay[] => {
  const thisMonday = startOfWeek(now);
  const weeks: WeekPay[] = [];
  for (let i = 0; i < count; i++) {
    const start = new Date(thisMonday);
    start.setDate(start.getDate() - i * 7);
    weeks.push(buildWeekPay(start, rides, now));
  }
  return weeks;
};

export interface DriverStats {
  period: SummaryPeriod;
  /** "this week" / "September" / "the last 6 months" — for the hero copy. */
  periodLabel: string;
  /** Dollars earned in the period (completed rides + cancellation payouts). */
  earned: number;
  /** Completed rides in the period. */
  rides: number;
  /** Km driven on completed rides in the period. */
  km: number;
  /** Average earned per completed ride; 0 when none. */
  perRide: number;
  /** Earnings from cancellation fees in the period (part of `earned`). */
  cancellationEarnings: number;
  chartTitle: string;
  chartHint: string;
  bars: SummaryBar[];
  lifetime: {
    rides: number;
    km: number;
    earned: number;
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Pure: buckets the driver's rides for the period. Exported for tests. */
export const buildDriverStats = (
  period: SummaryPeriod,
  rides: RideRequest[],
  now = new Date(),
): DriverStats => {
  const start = periodStart(period, now).getTime();
  const inPeriod = rides.filter((r) => {
    const t = earnedTime(r);
    return !Number.isNaN(t) && t >= start;
  });

  const completed = inPeriod.filter((r) => r.status === "completed");
  const cancelled = inPeriod.filter((r) => r.status === "cancelled");

  const earnedCompleted = completed.reduce((s, r) => s + rideEarned(r), 0);
  const cancellationEarnings = cancelled.reduce((s, r) => s + rideEarned(r), 0);
  const km = completed.reduce((s, r) => s + rideKm(r), 0);

  const { bars, chartTitle, chartHint } = bucketByPeriod(
    period,
    inPeriod,
    earnedTime,
    rideEarned,
    "Earnings",
    now,
  );

  const allCompleted = rides.filter((r) => r.status === "completed");
  const lifetime = {
    rides: allCompleted.length,
    km: allCompleted.reduce((s, r) => s + rideKm(r), 0),
    earned: round2(rides.reduce((s, r) => s + rideEarned(r), 0)),
  };

  const periodLabel =
    period === "week"
      ? "this week"
      : period === "month"
        ? now.toLocaleDateString(undefined, { month: "long" })
        : "the last 6 months";

  return {
    period,
    periodLabel,
    earned: round2(earnedCompleted + cancellationEarnings),
    rides: completed.length,
    km,
    perRide: completed.length ? round2(earnedCompleted / completed.length) : 0,
    cancellationEarnings: round2(cancellationEarnings),
    chartTitle,
    chartHint,
    bars: bars.map((b) => ({ ...b, value: round2(b.value) })),
    lifetime,
  };
};

/** Every completed or cancelled ride for the driver, sandbox rides excluded. */
export const fetchDriverRides = async (uid: string): Promise<RideRequest[]> => {
  const snap = await getDocs(
    query(
      collection(db, "rides"),
      where("driverId", "==", uid),
      where("status", "in", ["completed", "cancelled"]),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<RideRequest, "id">) }))
    .filter((r) => r.isTest !== true);
};
