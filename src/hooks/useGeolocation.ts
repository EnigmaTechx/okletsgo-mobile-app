import { useEffect, useState } from "react";
import * as Location from "expo-location";
import type { LatLng } from "../utils/geo";

/**
 * Foreground location for the rider: a single fix for "current location"
 * pickup, or a watch for the live map. One permission prompt is shared by
 * every caller so two screens never race the OS dialog.
 */

let pendingPermission: Promise<Location.PermissionStatus> | null = null;

export async function ensureForegroundLocation(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.status === "granted") return true;
  if (!current.canAskAgain) return false;
  if (!pendingPermission) {
    pendingPermission = Location.requestForegroundPermissionsAsync()
      .then((r) => r.status)
      .finally(() => {
        pendingPermission = null;
      });
  }
  return (await pendingPermission) === "granted";
}

export interface GeolocationState {
  location: LatLng | null;
  /** Permission denied, services off, or a fix never arrived. */
  error: string | null;
  /** True while the first fix is still being attempted. */
  locating: boolean;
}

export function useGeolocation(watch = false): GeolocationState {
  const [state, setState] = useState<GeolocationState>({
    location: null,
    error: null,
    locating: true,
  });

  useEffect(() => {
    let mounted = true;
    let sub: Location.LocationSubscription | null = null;

    const fail = (error: string) => {
      if (mounted) setState({ location: null, error, locating: false });
    };

    (async () => {
      try {
        if (!(await ensureForegroundLocation())) {
          fail("Location permission denied");
          return;
        }
        if (watch) {
          sub = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 5000,
              distanceInterval: 10,
            },
            (pos) => {
              if (!mounted) return;
              setState({
                location: {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                },
                error: null,
                locating: false,
              });
            },
          );
        } else {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          if (mounted)
            setState({
              location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              error: null,
              locating: false,
            });
        }
      } catch (err) {
        console.warn("Location unavailable:", err);
        fail(err instanceof Error ? err.message : "Location unavailable");
      }
    })();

    return () => {
      mounted = false;
      sub?.remove();
    };
  }, [watch]);

  return state;
}

/**
 * One GPS fix turned into a bookable place ("Use current location"). Null
 * when permission is refused or the address cannot be resolved.
 */
export async function getCurrentPlace(): Promise<{
  address: string;
  lat: number;
  lng: number;
} | null> {
  if (!(await ensureForegroundLocation())) return null;
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
  const { reverseGeocode } = await import("../services/googleMaps");
  const address = await reverseGeocode(point).catch(() => null);
  return address ? { address, ...point } : null;
}
