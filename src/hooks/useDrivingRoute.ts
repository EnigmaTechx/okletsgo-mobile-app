import { useEffect, useState } from "react";
import { fetchDrivingRoute, type DrivingRoute } from "../services/routing";
import type { LatLng } from "../utils/geo";

const routeKey = (a: LatLng, b: LatLng) =>
  `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;

/**
 * The road route between two points for drawing on the map. Re-fetches only
 * when either end moves (to four decimals, ~10 m), so a driver's jittering
 * GPS does not hammer the routing server.
 */
export function useDrivingRoute(
  from: LatLng | null | undefined,
  to: LatLng | null | undefined,
): DrivingRoute | null {
  const key = from && to ? routeKey(from, to) : null;
  const [result, setResult] = useState<{
    key: string;
    route: DrivingRoute | null;
  } | null>(null);

  useEffect(() => {
    if (!from || !to || !key) return;
    let active = true;
    fetchDrivingRoute(from, to).then((route) => {
      if (active) setResult({ key, route });
    });
    return () => {
      active = false;
    };
    // Keyed on the rounded coordinates, not the object identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return key && result?.key === key ? result.route : null;
}
