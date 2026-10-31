import type { RideRequest } from "../interfaces/ride";
import { scheduledDayTime } from "./rideDayGroups";

/* Buckets for the admin's All rides page (ported from the Ionic app): what
   is happening now, what is left today, what is coming up, each by pickup
   time, and the rest as history. */

/** Statuses of a ride that is under way right now. */
export const LIVE_STATUSES = new Set([
  "heading_to_pickup",
  "arrived",
  "in_progress",
  "en_route",
  "confirmed",
]);

export const isLiveRide = (r: RideRequest): boolean =>
  LIVE_STATUSES.has(r.status);

export interface TodayBuckets {
  /** Under way right now (whatever day it was booked for). */
  live: RideRequest[];
  /** Accepted, pickup today, soonest first. */
  upNext: RideRequest[];
  /** Still waiting on a driver, pickup today. */
  waiting: RideRequest[];
  /** Completed / cancelled / declined, pickup today, latest first. */
  done: RideRequest[];
}

export interface OpenRideBuckets {
  today: TodayBuckets;
  /** Accepted or requested, pickup after today, soonest first. */
  upcoming: RideRequest[];
  /** Badge counts: open work today (live + up next + waiting) and upcoming. */
  counts: { today: number; upcoming: number };
}

const dayStart = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const byTimeAsc = (a: RideRequest, b: RideRequest) =>
  scheduledDayTime(a) - scheduledDayTime(b);

export const bucketOpenRides = (
  rides: RideRequest[],
  now = new Date(),
): OpenRideBuckets => {
  const today = dayStart(now.getTime());
  const live: RideRequest[] = [];
  const upNext: RideRequest[] = [];
  const waiting: RideRequest[] = [];
  const done: RideRequest[] = [];
  const upcoming: RideRequest[] = [];

  for (const r of rides) {
    if (isLiveRide(r)) {
      live.push(r);
      continue;
    }
    const t = scheduledDayTime(r);
    if (Number.isNaN(t)) continue;
    const day = dayStart(t);
    if (day < today) continue; // history handles the past
    if (day === today) {
      if (r.status === "accepted") upNext.push(r);
      else if (r.status === "pending") waiting.push(r);
      else done.push(r);
    } else if (r.status === "accepted" || r.status === "pending") {
      upcoming.push(r);
    }
  }

  live.sort(byTimeAsc);
  upNext.sort(byTimeAsc);
  waiting.sort(byTimeAsc);
  done.sort((a, b) => byTimeAsc(b, a));
  upcoming.sort(byTimeAsc);

  return {
    today: { live, upNext, waiting, done },
    upcoming,
    counts: {
      today: live.length + upNext.length + waiting.length,
      upcoming: upcoming.length,
    },
  };
};

// ─── Driver filter ──────────────────────────────────────────────────────────

/** "all" | "none" (no driver assigned) | a driver's uid. */
export type DriverFilter = "all" | "none" | string;

export interface DriverOption {
  id: DriverFilter;
  label: string;
}

/** The drivers that appear in the given rides, by first name, plus an
 *  "Unassigned" option when any ride has no driver. */
export const driverOptions = (rides: RideRequest[]): DriverOption[] => {
  const seen = new Map<string, string>();
  let unassigned = false;
  for (const r of rides) {
    if (r.driverId) {
      if (!seen.has(r.driverId))
        seen.set(r.driverId, r.driverFirstName || "Driver");
    } else {
      unassigned = true;
    }
  }
  const out: DriverOption[] = Array.from(seen, ([id, label]) => ({
    id,
    label,
  })).sort((a, b) => a.label.localeCompare(b.label));
  if (unassigned) out.push({ id: "none", label: "Unassigned" });
  return out;
};

export const matchesDriver = (r: RideRequest, filter: DriverFilter): boolean =>
  filter === "all"
    ? true
    : filter === "none"
      ? !r.driverId
      : r.driverId === filter;
