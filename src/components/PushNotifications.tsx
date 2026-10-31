import { useEffect, useRef } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { fetchRide } from "../services/rideService";
import { listenForPushes, registerForPush } from "../services/pushService";

/**
 * Mounted once for a signed-in user with a profile: registers this device
 * for pushes and routes taps to the right screen. The ride document, not
 * the cached profile, decides the role, so a cold start from a push lands
 * correctly even before the profile has loaded.
 */
export function PushNotifications() {
  const router = useRouter();
  const { currentUser, userProfile } = useAuth();
  const uid = currentUser?.uid;
  const ready = !!uid && !!userProfile;
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    void registerForPush();
  }, [ready, uid]);

  useEffect(() => {
    if (!ready || !uid) return;
    return listenForPushes(async ({ rideId, type }) => {
      if (!rideId) return;
      // A cold start can report the same tap twice (FCM + local).
      const key = `${rideId}:${Date.now() >> 13}`;
      if (handled.current === key) return;
      handled.current = key;
      if (type === "chat") {
        router.push({
          pathname: "/(common)/chat/[id]",
          params: { id: rideId },
        });
        return;
      }
      try {
        const ride = await fetchRide(rideId);
        if (!ride) return;
        if (ride.status === "cancelled" || ride.status === "completed") {
          router.push({
            pathname: "/(common)/history/[id]",
            params: { id: rideId },
          });
        } else if (ride.driverId === uid) {
          router.push({
            pathname: "/(drive)/ride/[id]",
            params: { id: rideId },
          });
        } else {
          router.push({
            pathname: "/(ride)/live/[id]",
            params: { id: rideId },
          });
        }
      } catch (err) {
        console.error("Error routing notification:", err);
      }
    });
  }, [ready, uid, router]);

  return null;
}
