import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "@react-native-firebase/firestore";
import { db } from "./firebase";
import {
  completeRideTransaction,
  sortByScheduledTime,
  CLIENT_OPEN_STATUSES,
  LIVE_STATUSES,
} from "./rideService";
import type { RideRequest } from "../interfaces/ride";
import { calculateFare, SERVICE_FEE } from "../utils/fareCalculator";
import { haversineKm, type LatLng } from "../utils/geo";

/**
 * The rider's phone number for a ride. The notifyNewRideRequest function
 * moves it off the ride document into rides/{id}/private/contact (rider,
 * admin and owner may read it); older rides still carry passengerPhone.
 */
export async function fetchRideContactPhone(
  ride: RideRequest,
): Promise<string | null> {
  if (ride.passengerPhone) return ride.passengerPhone;
  if (!ride.id) return null;
  try {
    const snap = await getDoc(doc(db, "rides", ride.id, "private", "contact"));
    const phone = (snap.data() as { passengerPhone?: string } | undefined)
      ?.passengerPhone;
    return phone || null;
  } catch (e) {
    console.warn("[rides] contact document unavailable", e);
    return null;
  }
}

/**
 * Everything the driver side writes, on the same fields and in the same
 * order as the Ionic DriverRideDetails page. The completeRide function
 * remains the only thing that sets status "completed".
 */

export async function setDriverOnline(
  uid: string,
  online: boolean,
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { isOnline: online });
}

const toRide = (d: { id: string; data: () => unknown }): RideRequest =>
  ({ id: d.id, ...(d.data() as object) }) as RideRequest;

/** The driver's pending, accepted and live rides, soonest first. */
export function subscribeDriverOpenRides(
  uid: string,
  onChange: (rides: RideRequest[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, "rides"),
      where("driverId", "==", uid),
      where("status", "in", CLIENT_OPEN_STATUSES),
    ),
    (snap) => onChange(sortByScheduledTime(snap.docs.map(toRide))),
    (err) => {
      console.error("Driver rides listener failed:", err);
      onError?.(err);
    },
  );
}

/**
 * True while the driver has another ride live (heading / arrived / in
 * progress). Used to block starting a second trip.
 */
export function subscribeOtherLiveRide(
  uid: string,
  excludeRideId: string,
  onChange: (occupied: boolean) => void,
): () => void {
  return onSnapshot(
    query(
      collection(db, "rides"),
      where("driverId", "==", uid),
      where("status", "in", LIVE_STATUSES),
    ),
    (snap) => onChange(snap.docs.some((d) => d.id !== excludeRideId)),
    (err) => console.warn("Occupied check failed:", err),
  );
}

/** Pending + accepted rides, for the time-change conflict check. */
export async function fetchDriverSchedule(uid: string): Promise<RideRequest[]> {
  const snap = await getDocs(
    query(
      collection(db, "rides"),
      where("driverId", "==", uid),
      where("status", "in", ["pending", "accepted"]),
    ),
  );
  return snap.docs.map(toRide);
}

export async function writeDriverLocation(
  rideId: string,
  point: LatLng,
): Promise<void> {
  await updateDoc(doc(db, "rides", rideId), {
    driverLocation: {
      lat: point.lat,
      lng: point.lng,
      updatedAt: new Date().toISOString(),
    },
  });
}

/** Driver taps "Head to pickup": status + timestamp + where they set off. */
export async function headToPickup(
  rideId: string,
  from: LatLng | null,
): Promise<void> {
  const update: Record<string, unknown> = {
    status: "heading_to_pickup",
    headedToPickupAt: new Date().toISOString(),
  };
  if (from) update.driverStartLocation = { lat: from.lat, lng: from.lng };
  await updateDoc(doc(db, "rides", rideId), update);
}

export async function markArrived(rideId: string): Promise<void> {
  await updateDoc(doc(db, "rides", rideId), {
    status: "arrived",
    arrivedAtPickupAt: new Date().toISOString(),
  });
}

export async function startTrip(rideId: string): Promise<void> {
  await updateDoc(doc(db, "rides", rideId), {
    status: "in_progress",
    tripStartedAt: new Date().toISOString(),
  });
}

export interface CompleteTripMeta {
  /** Set when the trip ended away from the drop-off. */
  actualDistanceKm?: number;
  earlyEndReason?: string;
}

/** Pure: the fields written alongside completion. Exported for tests. */
export function completionFields(
  ride: RideRequest,
  meta: CompleteTripMeta | undefined,
  nowIso: string,
): Record<string, unknown> {
  let totalKm = Number(ride.distance) || 0;
  const start = ride.driverStartLocation;
  if (
    start?.lat !== undefined &&
    start?.lng !== undefined &&
    ride.pickup?.lat !== undefined &&
    ride.pickup?.lng !== undefined
  ) {
    totalKm += haversineKm(
      { lat: start.lat, lng: start.lng },
      { lat: ride.pickup.lat, lng: ride.pickup.lng },
    );
  }
  const fields: Record<string, unknown> = {
    totalKmTravelled: parseFloat(totalKm.toFixed(2)),
    tripCompletedAt: nowIso,
  };
  if (meta?.actualDistanceKm !== undefined) {
    // Round once so the priced and stored actual distance match.
    const actualDistanceKm = parseFloat(meta.actualDistanceKm.toFixed(2));
    const actualTripCost = Math.min(
      calculateFare(actualDistanceKm),
      ride.estimatedPrice,
    );
    fields.estimatedPrice = actualTripCost;
    fields.totalClientCharge = parseFloat(
      (actualTripCost + SERVICE_FEE).toFixed(2),
    );
    fields.platformFee = SERVICE_FEE;
    fields.actualDistanceKm = actualDistanceKm;
    fields.endedEarly = true;
    fields.earlyEndReason = meta.earlyEndReason;
  }
  return fields;
}

/**
 * Complete the trip. The completeRide function sets status "completed"
 * server-side with the earnings credit; the distance/time fields here are
 * independent on a normal completion so both go out at once. An early end
 * rewrites estimatedPrice, which the function uses for the payout, so that
 * case stays in order.
 */
export async function completeTrip(
  ride: RideRequest,
  meta?: CompleteTripMeta,
): Promise<void> {
  if (!ride.id) throw new Error("Ride ID is missing.");
  const ref = doc(db, "rides", ride.id);
  const fields = completionFields(ride, meta, new Date().toISOString());
  if (meta?.actualDistanceKm !== undefined) {
    await updateDoc(ref, fields);
    await completeRideTransaction(ride);
  } else {
    await Promise.all([updateDoc(ref, fields), completeRideTransaction(ride)]);
  }
}
