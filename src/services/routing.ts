import type { LatLng } from "../utils/geo";

/**
 * Road routes from the public OSRM server, for drawing the route line and
 * for live ETAs. The Ionic app leans on the same server (leaflet-routing-
 * machine's default and its ETA fetch), so this keeps behaviour and cost
 * identical. Fares never depend on it: distance comes from Google.
 */

const OSRM = "https://router.project-osrm.org/route/v1/driving";

export interface DrivingRoute {
  coords: LatLng[];
  distanceKm: number;
  durationSec: number;
}

interface OsrmBody {
  code?: string;
  routes?: {
    distance?: number;
    duration?: number;
    geometry?: { coordinates?: [number, number][] };
  }[];
}

/** Pure: OSRM's GeoJSON ([lng, lat]) → our {lat, lng} list. */
export const parseOsrmRoute = (body: OsrmBody): DrivingRoute | null => {
  const r = body.routes?.[0];
  if (body.code !== "Ok" || !r) return null;
  const coords = (r.geometry?.coordinates ?? [])
    .filter((c) => Array.isArray(c) && c.length === 2)
    .map(([lng, lat]) => ({ lat, lng }));
  return {
    coords,
    distanceKm: (r.distance ?? 0) / 1000,
    durationSec: Math.round(r.duration ?? 0),
  };
};

const key = (a: LatLng, b: LatLng, full: boolean) =>
  `${a.lat.toFixed(4)},${a.lng.toFixed(4)}|${b.lat.toFixed(4)},${b.lng.toFixed(4)}|${full ? 1 : 0}`;

const cache = new Map<string, Promise<DrivingRoute | null>>();

async function request(
  from: LatLng,
  to: LatLng,
  full: boolean,
): Promise<DrivingRoute | null> {
  const qs = full ? "overview=full&geometries=geojson" : "overview=false";
  const res = await fetch(
    `${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?${qs}`,
  );
  if (!res.ok) return null;
  return parseOsrmRoute((await res.json()) as OsrmBody);
}

/**
 * The drivable route between two points, with its line. Results are cached
 * per rounded coordinate pair; a failed lookup is not cached so it retries.
 */
export function fetchDrivingRoute(
  from: LatLng,
  to: LatLng,
): Promise<DrivingRoute | null> {
  const k = key(from, to, true);
  const hit = cache.get(k);
  if (hit) return hit;
  const p = request(from, to, true)
    .then((r) => {
      if (!r) cache.delete(k);
      return r;
    })
    .catch((err) => {
      console.warn("OSRM route failed:", err);
      cache.delete(k);
      return null;
    });
  cache.set(k, p);
  return p;
}

/** Road ETA only (no geometry), for the live status line. Never throws. */
export async function fetchEtaSeconds(
  from: LatLng,
  to: LatLng,
): Promise<number | null> {
  try {
    const r = await request(from, to, false);
    return r ? r.durationSec : null;
  } catch {
    return null;
  }
}
