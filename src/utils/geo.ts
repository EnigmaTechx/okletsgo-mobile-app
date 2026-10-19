export interface LatLng {
  lat: number;
  lng: number;
}

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance in km between two points. */
export const haversineKm = (a: LatLng, b: LatLng): number => {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/** A usable coordinate pair from a ride point, or null (missing / 0,0). */
export const pointOf = (p?: { lat?: number; lng?: number } | null): LatLng | null => {
  if (!p) return null;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
};

/**
 * Straight-line km from where the driver is to a ride point, or null when
 * either side is unknown. Straight-line is what Lyft shows on the request
 * card too — close enough to judge "is this worth it", no routing call.
 */
export const kmFromDriver = (
  here: LatLng | null | undefined,
  point?: { lat?: number; lng?: number } | null,
): number | null => {
  const target = pointOf(point);
  if (!here || !target) return null;
  return haversineKm(here, target);
};

/** "0.8 km", "3.2 km", "14 km", "120 km" */
export const formatKm = (km: number): string => {
  if (!Number.isFinite(km)) return "—";
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
};
