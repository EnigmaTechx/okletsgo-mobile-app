import type { RideRequest } from "../interfaces/ride";
import { haversineKm, pointOf, type LatLng } from "./geo";

/**
 * ETA wording for the rider's live screen. Road ETAs come from OSRM when a
 * route is available; otherwise a straight-line estimate at 40 km/h, the
 * same fallback the Ionic app used.
 */

const FALLBACK_KMH = 40;

/** Seconds to a point at the fallback speed, or null without coordinates. */
export const fallbackEtaSeconds = (
  from: LatLng | null | undefined,
  to?: { lat?: number; lng?: number } | null,
): number | null => {
  const target = pointOf(to);
  if (!from || !target) return null;
  const km = haversineKm(from, target);
  return Math.max(60, Math.round((km / FALLBACK_KMH) * 3600));
};

/** "Arriving now" / "Arriving in ~6 min" for the driver heading to pickup. */
export const pickupEtaLabel = (etaSeconds: number | null): string => {
  if (etaSeconds === null) return "Driver on the way";
  if (etaSeconds < 60) return "Arriving now";
  return `Arriving in ~${Math.round(etaSeconds / 60)} min`;
};

/**
 * Drop-off is a clock time ("Arriving at 8:15 PM") because riders think
 * about when they will get there, not how long is left.
 */
export const dropoffEtaLabel = (
  etaSeconds: number | null,
  now = new Date(),
): string => {
  if (etaSeconds === null) return "Trip in progress";
  if (etaSeconds < 60) return "Arriving now";
  const at = new Date(now.getTime() + etaSeconds * 1000);
  return `Arriving at ${at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
};

/** The headline on the rider's live panel for the ride's current state. */
export const clientStatusLabel = (
  ride: Pick<
    RideRequest,
    | "status"
    | "driverFirstName"
    | "forwardHistory"
    | "driverLocation"
    | "pickup"
    | "destination"
  >,
  etaSeconds: number | null,
  now = new Date(),
): string => {
  switch (ride.status) {
    case "pending": {
      const last = ride.forwardHistory?.[ride.forwardHistory.length - 1];
      return last
        ? `${last.fromDriverFirstName} can't take this one. Waiting for ${ride.driverFirstName || "a driver"}…`
        : "Waiting for driver…";
    }
    case "accepted":
      return "Driver accepted";
    case "heading_to_pickup":
      return pickupEtaLabel(
        etaSeconds ?? fallbackEtaSeconds(ride.driverLocation, ride.pickup),
      );
    case "arrived":
      return "Driver has arrived";
    case "in_progress":
      return dropoffEtaLabel(
        etaSeconds ?? fallbackEtaSeconds(ride.driverLocation, ride.destination),
        now,
      );
    default:
      return ride.status.replace(/_/g, " ").toUpperCase();
  }
};

/**
 * The big line at the top of the live panel, in the driver's name:
 * "Marcus is ~4 min away", "Marcus has arrived", "Arriving at 8:15 PM".
 */
export const clientHeadline = (
  ride: Pick<
    RideRequest,
    | "status"
    | "driverFirstName"
    | "forwardHistory"
    | "driverLocation"
    | "pickup"
    | "destination"
  >,
  etaSeconds: number | null,
  now = new Date(),
): string => {
  const name = ride.driverFirstName || "Your driver";
  switch (ride.status) {
    case "pending": {
      const last = ride.forwardHistory?.[ride.forwardHistory.length - 1];
      return last
        ? `${last.fromDriverFirstName} can't take this one. Waiting for ${ride.driverFirstName || "a driver"}…`
        : "Waiting for a driver…";
    }
    case "accepted":
      return `${name} accepted your ride`;
    case "heading_to_pickup": {
      const secs =
        etaSeconds ?? fallbackEtaSeconds(ride.driverLocation, ride.pickup);
      if (secs === null) return `${name} is on the way`;
      if (secs < 60) return `${name} is arriving now`;
      return `${name} is ~${Math.round(secs / 60)} min away`;
    }
    case "arrived":
      return `${name} has arrived`;
    case "in_progress":
      return dropoffEtaLabel(
        etaSeconds ?? fallbackEtaSeconds(ride.driverLocation, ride.destination),
        now,
      );
    case "completed":
      return "You've arrived";
    default:
      return ride.status.replace(/_/g, " ");
  }
};

/** Trip progress, 0–4, for the four-segment bar on the live panel. */
export const progressStep = (status: RideRequest["status"]): number =>
  ({
    pending: 0,
    accepted: 1,
    heading_to_pickup: 2,
    arrived: 3,
    in_progress: 4,
    completed: 4,
  })[status as string] ?? 0;
