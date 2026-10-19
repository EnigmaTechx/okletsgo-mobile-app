import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  addDoc,
  doc,
  updateDoc,
  increment,
} from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";
import { db, functions } from "./firebase";
import type { UserProfile } from "../interfaces/user";
import type { RideRequest } from "../interfaces/ride";

/**
 * Count a user's completed rides. For a client this is rides they've taken;
 * for a driver, rides they've completed. Uses a server-side aggregation count
 * (no document reads) and relies on the existing rides composite indexes
 * (clientId+status / driverId+status). Returns 0 on any failure.
 */
export const countCompletedRides = async (
  userId: string,
  role: "driver" | "client",
): Promise<number> => {
  try {
    const field = role === "driver" ? "driverId" : "clientId";
    const q = query(
      collection(db, "rides"),
      where(field, "==", userId),
      where("status", "==", "completed"),
    );
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (err) {
    console.warn("Failed to count completed rides:", err);
    return 0;
  }
};

export const getAvailableDrivers = async (): Promise<UserProfile[]> => {
  try {
    const q = query(
      collection(db, "users"),
      where("role", "==", "driver"),
      where("isOnline", "==", true),
    );
    const snapshot = await getDocs(q);
    const drivers = snapshot.docs.map((d) => d.data() as UserProfile);
    // Extra safety: filter out any drivers who haven't set up their vehicle yet
    return drivers.filter((d) => d.vehicle !== undefined);
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return [];
  }
};

export const updateRideStatus = async (rideId: string, status: string): Promise<void> => {
  await updateDoc(doc(db, "rides", rideId), { status });
};

export const createRideRequest = async (rideData: RideRequest): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, "rides"), rideData);
    return docRef.id;
  } catch (error) {
    console.error("Error creating ride:", error);
    throw error;
  }
};

const callableError = (error: unknown, fallback: string): Error =>
  error instanceof Error ? new Error(error.message) : new Error(fallback);

export const cancelRide = async (
  rideId: string,
  reason: string,
  cancelledBy: "client" | "driver",
) => {
  const cancelRideFn = httpsCallable(functions, "cancelRide");
  try {
    const response = await cancelRideFn({ rideId, reason, cancelledBy });
    return response.data;
  } catch (error) {
    console.error("Failed to cancel ride:", error);
    throw callableError(error, "An unknown error occurred while canceling the ride.");
  }
};

export interface DeclineResult {
  /** True when the request was handed to another driver instead of ending. */
  forwarded: boolean;
  /** The new driver's first name when forwarded. */
  driverFirstName?: string;
}

export const respondToRide = async (
  rideId: string,
  action: "accept" | "decline",
  declineReason?: string,
): Promise<DeclineResult | void> => {
  if (action === "accept") {
    const acceptRideFn = httpsCallable(functions, "acceptRide");
    try {
      await acceptRideFn({ rideId });
    } catch (error) {
      console.error("Failed to accept ride:", error);
      throw callableError(error, "Failed to place a hold on the rider's card.");
    }
    return;
  }

  // Declines go through a function so the hand-off to the next driver (when
  // the rider opted in) happens in one atomic step — the rider never sees a
  // momentary "declined" before the new driver appears.
  const declineRideFn = httpsCallable<{ rideId: string; reason: string }, DeclineResult>(
    functions,
    "declineRide",
  );
  try {
    const res = await declineRideFn({ rideId, reason: declineReason || "No reason provided" });
    return res.data;
  } catch (error) {
    console.error("Failed to decline ride:", error);
    throw callableError(error, "Couldn't decline the request. Please try again.");
  }
};

/** Atomic completion: marks the ride completed AND updates money balances. */
export const completeRideTransaction = async (ride: RideRequest) => {
  if (!ride.id) throw new Error("Ride ID is missing.");
  const completeRideFn = httpsCallable(functions, "completeRide");
  try {
    const response = await completeRideFn({ rideId: ride.id });
    return response.data;
  } catch (error) {
    console.error("Failed to complete ride:", error);
    throw callableError(error, "An unknown error occurred while completing the ride.");
  }
};

// Only nudge clients to rate very recent trips. This keeps the launch clean —
// nobody gets nagged to rate a pile of old rides they took before ratings
// existed — and long-term it only asks about trips still fresh in memory.
export const RATING_NUDGE_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

/** When a ride finished (completion time preferred, created time fallback). */
export const rideCompletionMs = (r: RideRequest): number => {
  const raw = r.completedAt || r.tripCompletedAt || r.createdAt;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? 0 : t;
};

// A place the client has been to/from before, derived from ride history — no
// separate storage, we just read it back off completed rides.
export interface RecentPlace {
  address: string;
  lat: number;
  lng: number;
}

/**
 * Recently-used addresses from the client's completed rides (both pickup and
 * drop-off), most-recent-first and de-duplicated by address. Powers the
 * "Recent" quick-pick at booking time.
 */
export const getRecentPlaces = async (clientId: string, max = 6): Promise<RecentPlace[]> => {
  try {
    const q = query(
      collection(db, "rides"),
      where("clientId", "==", clientId),
      where("status", "==", "completed"),
      orderBy("createdAt", "desc"),
      limit(20),
    );
    const snap = await getDocs(q);
    return recentPlacesFrom(snap.docs.map((d) => d.data() as RideRequest), max);
  } catch (err) {
    console.warn("Failed to load recent places:", err);
    return [];
  }
};

/** Pure: de-duplicated pickup + destination addresses, newest ride first. */
export const recentPlacesFrom = (rides: RideRequest[], max = 6): RecentPlace[] => {
  const seen = new Set<string>();
  const out: RecentPlace[] = [];
  for (const r of rides) {
    for (const pt of [r.pickup, r.destination]) {
      if (!pt?.address || typeof pt.lat !== "number" || typeof pt.lng !== "number") continue;
      const key = pt.address.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ address: pt.address, lat: pt.lat, lng: pt.lng });
      if (out.length >= max) return out;
    }
  }
  return out;
};

/**
 * Find this client's most recent completed ride that hasn't been rated yet and
 * is recent enough to be worth prompting for, so the home screen can nudge them
 * (Uber/Lyft-style lazy prompt). Returns null if there's nothing fresh to rate.
 */
export const getPendingRatingRide = async (clientId: string): Promise<RideRequest | null> => {
  try {
    const q = query(
      collection(db, "rides"),
      where("clientId", "==", clientId),
      where("status", "==", "completed"),
      orderBy("createdAt", "desc"),
      limit(5),
    );
    const snap = await getDocs(q);
    const cutoff = Date.now() - RATING_NUDGE_MAX_AGE_MS;
    const unrated = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as RideRequest)
      .find(
        (r) =>
          r.driverId &&
          typeof r.driverRatingByClient !== "number" &&
          rideCompletionMs(r) >= cutoff,
      );
    return unrated || null;
  } catch (err) {
    console.warn("Failed to check for pending rating:", err);
    return null;
  }
};

/**
 * Submit the client's 1–5 star rating (and optional comment) for the driver on
 * a completed ride. Server-side it's folded into the driver's running average.
 * One rating per ride.
 */
export const submitRideRating = async (
  rideId: string,
  rating: number,
  comment?: string,
): Promise<void> => {
  const fn = httpsCallable(functions, "submitRideRating");
  await fn({ rideId, rating, comment: comment || "" });
};

/**
 * Client changes the pickup time of an upcoming ride. Server enforces the
 * gates. Returns whether the change needs the driver's approval (a material
 * earlier-time change on an accepted ride) or was applied immediately.
 */
export const requestRideTimeChange = async (
  rideId: string,
  newTime: string,
): Promise<{ pendingApproval: boolean }> => {
  const fn = httpsCallable<{ rideId: string; newTime: string }, { pendingApproval?: boolean }>(
    functions,
    "requestRideTimeChange",
  );
  const res = await fn({ rideId, newTime });
  return { pendingApproval: !!res.data?.pendingApproval };
};

/** Assigned driver approves or declines a pending pickup-time change. */
export const reviewRideTimeChange = async (rideId: string, approve: boolean): Promise<void> => {
  const fn = httpsCallable(functions, "reviewRideTimeChange");
  await fn({ rideId, approve });
};

export const incrementClientDebt = async (clientId: string, amount: number): Promise<void> => {
  await updateDoc(doc(db, "users", clientId), { debt: increment(amount) });
};

export const updateDriverLocation = async (
  rideId: string,
  lat: number,
  lng: number,
): Promise<void> => {
  await updateDoc(doc(db, "rides", rideId), {
    driverLocation: { lat, lng, updatedAt: new Date().toISOString() },
  });
};
