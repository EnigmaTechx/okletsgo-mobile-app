import type { RideRequest } from "../interfaces/ride";

/**
 * Splits a driver's open rides for the home screen (as the Ionic app):
 *  - live:          a trip under way
 *  - needsResponse: requests (pending) for today or tomorrow, pinned on top
 *                   so imminent requests can't hide below accepted rides
 *  - comingUp:      accepted rides plus requests for later days, mixed and
 *                   in pickup order, so each day shows everything it holds
 *  - nextPickup:    the soonest accepted ride
 * Requests with no usable pickup time count as imminent.
 */

export const LIVE = new Set<string>([
  "heading_to_pickup",
  "arrived",
  "in_progress",
]);

const pickupMs = (r: RideRequest): number => {
  const t = new Date(r.scheduledTime || "").getTime();
  return Number.isNaN(t) ? -Infinity : t;
};

const startOfDay = (d: Date, addDays = 0): number => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + addDays);
  return x.getTime();
};

const byPickup = (a: RideRequest, b: RideRequest) => pickupMs(a) - pickupMs(b);

export interface DriverHome {
  live: RideRequest[];
  needsResponse: RideRequest[];
  comingUp: RideRequest[];
  nextPickup: RideRequest | null;
  /** Requests waiting for a response that are for today. */
  todayRequests: number;
}

export function splitDriverHome(
  rides: RideRequest[],
  now = new Date(),
): DriverHome {
  const imminentEnd = startOfDay(now, 2); // end of tomorrow
  const tomorrowStart = startOfDay(now, 1);

  const live = rides.filter((r) => LIVE.has(r.status)).sort(byPickup);
  const pending = rides.filter((r) => r.status === "pending");
  const accepted = rides.filter((r) => r.status === "accepted").sort(byPickup);

  const needsResponse = pending
    .filter((r) => pickupMs(r) < imminentEnd)
    .sort(byPickup);
  const later = pending.filter((r) => pickupMs(r) >= imminentEnd);
  const comingUp = [...accepted, ...later].sort(byPickup);

  return {
    live,
    needsResponse,
    comingUp,
    nextPickup: accepted[0] ?? null,
    todayRequests: needsResponse.filter((r) => pickupMs(r) < tomorrowStart)
      .length,
  };
}

/**
 * The dispatcher's own request with a fallback clock running: "Auto-assigns
 * in 7 min" / "Reminder in 7 min". Null for anyone else or once it passed.
 */
export const dispatchChip = (
  r: RideRequest,
  uid: string | undefined,
  now = Date.now(),
): string | null => {
  if (!uid || r.dispatcherId !== uid || r.driverId !== uid) return null;
  if (!r.dispatchDeadline || r.dispatchFallback === "keep_waiting") return null;
  const left = new Date(r.dispatchDeadline).getTime() - now;
  if (!Number.isFinite(left) || left <= 0) return null;
  const min = Math.max(1, Math.ceil(left / 60000));
  return r.dispatchFallback === "remind"
    ? `Reminder in ${min} min`
    : `Auto-assigns in ${min} min`;
};
