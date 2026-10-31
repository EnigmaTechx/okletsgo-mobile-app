import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  type QueryConstraint,
} from "@react-native-firebase/firestore";
import { db } from "./firebase";
import type { UserProfile, VehicleInfo } from "../interfaces/user";

/**
 * What one user may see about another: publicProfiles/{uid}, mirrored from
 * users/{uid} by the syncPublicProfile function. Private details (phone,
 * email, saved places, money) stay in users/{uid}, which other users can't
 * read once the tightened rules are deployed.
 *
 * Rollout (same as the Ionic app): until every user has a public profile
 * the reads fall back to users/{uid}. That fallback stops working,
 * harmlessly returning nothing, once the tightened rules are live.
 */

export interface PublicProfile {
  uid: string;
  firstName: string;
  role?: UserProfile["role"] | null;
  photoUrl?: string | null;
  isTestAccount?: boolean;
  status?: UserProfile["status"] | null;
  // Drivers only
  isOnline?: boolean;
  isApproved?: boolean | null;
  rating?: number | null;
  ratingCount?: number | null;
  vehicle?: Partial<
    Pick<VehicleInfo, "make" | "model" | "color" | "plateNumber" | "photoUrl">
  > | null;
}

const VEHICLE_KEYS = [
  "make",
  "model",
  "color",
  "plateNumber",
  "photoUrl",
] as const;

/** Same subset as the function's publicProfileOf(), for the fallback. */
export const fromPrivate = (
  uid: string,
  u: Partial<UserProfile>,
): PublicProfile => ({
  uid,
  firstName: u.firstName ?? "",
  role: u.role ?? null,
  photoUrl: u.photoUrl ?? null,
  isTestAccount: u.isTestAccount === true,
  status: u.status ?? null,
  isOnline: u.isOnline === true,
  isApproved: typeof u.isApproved === "boolean" ? u.isApproved : null,
  rating: u.rating ?? null,
  ratingCount: u.ratingCount ?? null,
  vehicle: u.vehicle
    ? (Object.fromEntries(
        VEHICLE_KEYS.map((k) => [k, u.vehicle?.[k] ?? null]),
      ) as PublicProfile["vehicle"])
    : null,
});

export async function getPublicProfile(
  uid: string,
): Promise<PublicProfile | null> {
  if (!uid) return null;
  try {
    const pub = await getDoc(doc(db, "publicProfiles", uid));
    if (pub.exists()) return { ...(pub.data() as PublicProfile), uid };
  } catch (e) {
    console.warn("[publicProfiles] read failed", e);
  }
  try {
    const priv = await getDoc(doc(db, "users", uid));
    return priv.exists() ? fromPrivate(uid, priv.data() as UserProfile) : null;
  } catch {
    return null; // tightened rules: no fallback to private profiles
  }
}

/** Drivers' public profiles (optionally only those online now). */
export async function listPublicDrivers(
  opts: { onlineOnly?: boolean } = {},
): Promise<PublicProfile[]> {
  const filters: QueryConstraint[] = [where("role", "==", "driver")];
  if (opts.onlineOnly) filters.push(where("isOnline", "==", true));
  try {
    const snap = await getDocs(
      query(collection(db, "publicProfiles"), ...filters),
    );
    if (!snap.empty)
      return snap.docs.map((d) => ({
        ...(d.data() as PublicProfile),
        uid: d.id,
      }));
  } catch (e) {
    console.warn("[publicProfiles] driver list failed", e);
  }
  try {
    const snap = await getDocs(query(collection(db, "users"), ...filters));
    return snap.docs.map((d) => fromPrivate(d.id, d.data() as UserProfile));
  } catch {
    return [];
  }
}

/** A driver a rider could be booked with: approved, active, with a car. */
export const isBookableDriver = (d: PublicProfile): boolean =>
  d.isApproved !== false &&
  !!d.vehicle &&
  d.status !== "suspended" &&
  d.status !== "scheduled_for_deletion";
