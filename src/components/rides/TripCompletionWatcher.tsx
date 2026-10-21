import { useEffect } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  fetchRide,
  subscribeClientOpenRides,
} from "../../services/rideService";
import { sessionFlag, tripCompleteShownKey } from "../../utils/sessionFlags";

/**
 * Mounted once under the rider's tabs: when one of their rides leaves the
 * open list because the driver completed it, opens the "You've arrived"
 * screen wherever the rider is in the app. The live screen handles its
 * own completion and marks the same session flag, so the two never
 * double up. Rides that finished while the app was closed are covered by
 * Home's rating nudge instead.
 */
export function TripCompletionWatcher() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const check = async (rideId: string) => {
      const key = tripCompleteShownKey(rideId);
      if (sessionFlag.has(key)) return;
      try {
        const ride = await fetchRide(rideId);
        if (
          !ride ||
          ride.status !== "completed" ||
          typeof ride.driverRatingByClient === "number" ||
          sessionFlag.has(key)
        )
          return;
        sessionFlag.set(key);
        router.push({
          pathname: "/(ride)/complete/[id]",
          params: { id: rideId },
        });
      } catch (err) {
        console.warn("Could not check a finished ride:", err);
      }
    };
    return subscribeClientOpenRides(uid, (_rides, departedIds) => {
      departedIds.forEach((id) => void check(id));
    });
  }, [uid, router]);

  return null;
}
