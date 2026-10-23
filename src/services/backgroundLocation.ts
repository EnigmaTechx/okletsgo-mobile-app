import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { writeDriverLocation } from "./driverService";
import { haversineKm, type LatLng } from "../utils/geo";

/**
 * Background location during a trip (driver only). A foreground service on
 * Android keeps the fixes coming with the app in the background; each one
 * is written to the ride's driverLocation, throttled to real movement.
 *
 * Google Play's prominent-disclosure rule: the trip screen shows the
 * disclosure and records consent BEFORE `startTripTracking` asks the OS
 * for background permission. Never call this without that consent.
 */

export const TRIP_LOCATION_TASK = "okletsgo.tripLocation";
const RIDE_KEY = "okletsgo.trackingRideId";

/** Minimum move / time between writes, matching the Ionic throttle. */
const MIN_MOVE_KM = 0.025;
const MIN_INTERVAL_MS = 15_000;
let last: { point: LatLng; at: number } | null = null;

const shouldWrite = (point: LatLng, now: number): boolean => {
  if (!last) return true;
  return (
    haversineKm(last.point, point) >= MIN_MOVE_KM ||
    now - last.at >= MIN_INTERVAL_MS
  );
};

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(
  TRIP_LOCATION_TASK,
  async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const rideId = await AsyncStorage.getItem(RIDE_KEY);
    if (!rideId) return;
    const latest = data.locations[data.locations.length - 1];
    const point = {
      lat: latest.coords.latitude,
      lng: latest.coords.longitude,
    };
    const now = Date.now();
    if (!shouldWrite(point, now)) return;
    last = { point, at: now };
    try {
      await writeDriverLocation(rideId, point);
    } catch (err) {
      console.warn("Background location write failed:", err);
    }
  },
);

/**
 * Ask the OS for background location (foreground must already be granted)
 * and start the updates for `rideId`. Resolves false when the permission
 * was refused; the foreground watcher on the trip screen still keeps the
 * rider updated while the app is open.
 */
export async function startTripTracking(rideId: string): Promise<boolean> {
  const fg = await Location.getForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return false;
  await AsyncStorage.setItem(RIDE_KEY, rideId);
  last = null;
  if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK))
    return true;
  await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 30,
    timeInterval: 10_000,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Active ride — location tracking on",
      notificationBody: "Tap to return to OK Let's Go!",
      notificationColor: "#F14B1C",
    },
  });
  return true;
}

export async function stopTripTracking(): Promise<void> {
  await AsyncStorage.removeItem(RIDE_KEY);
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
    }
  } catch (err) {
    console.warn("Stopping background location failed:", err);
  }
}

/** The ride being tracked by the background task, if any. */
export const trackedRideId = (): Promise<string | null> =>
  AsyncStorage.getItem(RIDE_KEY);
