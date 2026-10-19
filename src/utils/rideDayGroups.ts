import type { RideRequest } from "../interfaces/ride";

export interface DayGroup {
  key: string;
  label: string;
  rides: RideRequest[];
}

/** "Mon, 23 Sep" — always weekday + date (no "Today"/"Yesterday"), with the
 *  year added only when it isn't the current year. */
export const dayLabel = (d: Date, now = new Date()): string =>
  d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });

const startOfDay = (d: Date): number => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

/** "Today" / "Tomorrow" for the driver's upcoming list, else null. */
export const relativeDay = (d: Date, now = new Date()): string | null => {
  const diffDays = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return null;
};

/** "Today · Wed 8 Oct", "Tomorrow · Thu 9 Oct", then just "Fri 10 Oct". The
 *  weekday and date are always present (Ride History's rule); the relative
 *  word is added for the two days a driver plans around. */
export const upcomingDayLabel = (d: Date, now = new Date()): string => {
  const rel = relativeDay(d, now);
  const label = dayLabel(d, now);
  return rel ? `${rel} · ${label}` : label;
};

/**
 * Groups rides by local calendar day; rides within a day keep the order they
 * were given. History wants newest day first (the default); the driver's
 * upcoming list wants soonest first (`order: "asc"`). Rides with no usable
 * date land in a trailing "Undated" group rather than being dropped.
 * Grouping is over the whole array each time, so pages appended by infinite
 * scroll slot into the right day.
 */
/** Default day for a ride: its pickup time (booking time as a fallback). */
export const scheduledDayTime = (ride: RideRequest): number =>
  new Date(ride.scheduledTime || ride.createdAt || "").getTime();

export const groupRidesByDay = (
  rides: RideRequest[],
  now = new Date(),
  order: "asc" | "desc" = "desc",
  labelFor: (day: Date, now: Date) => string = dayLabel,
  /** Which instant decides a ride's day. Pay views group by when the money
   *  was earned (completion / cancellation), not by the pickup time. */
  timeOf: (ride: RideRequest) => number = scheduledDayTime,
): DayGroup[] => {
  const byKey = new Map<string, DayGroup & { time: number }>();
  for (const ride of rides) {
    const d = new Date(timeOf(ride));
    const day = Number.isNaN(d.getTime()) ? null : new Date(d);
    if (day) day.setHours(0, 0, 0, 0);
    const key = day ? String(day.getTime()) : "undated";
    let g = byKey.get(key);
    if (!g) {
      g = {
        key,
        label: day ? labelFor(day, now) : "Undated",
        rides: [],
        // Undated always trails, whichever direction the list runs.
        time: day ? day.getTime() : order === "desc" ? -Infinity : Infinity,
      };
      byKey.set(key, g);
    }
    g.rides.push(ride);
  }
  return Array.from(byKey.values())
    .sort((a, b) => (order === "desc" ? b.time - a.time : a.time - b.time))
    .map(({ key, label, rides }) => ({ key, label, rides }));
};
