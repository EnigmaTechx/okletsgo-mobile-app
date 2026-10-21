import {
  ONTARIO_BOUNDS,
  ontarioOnly,
  type PlacePrediction,
} from "../utils/places";
import { cleanPredictionAddress } from "../utils/address";
import type { LatLng } from "../utils/geo";

/**
 * Google Maps Platform web services, called directly from the app: Places
 * Autocomplete, Geocoding and Distance Matrix. These are the same three the
 * Ionic app reaches through the Maps JavaScript SDK, so fares keep pricing
 * the same Google driving distance.
 *
 * The key is EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (inlined at build time). It must
 * not carry HTTP-referrer restrictions; see docs/PHASE2.md.
 */

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const BASE = "https://maps.googleapis.com/maps/api";

export const hasMapsKey = (): boolean => KEY.trim().length > 0;

export class MapsApiError extends Error {
  constructor(
    public readonly status: string,
    message: string,
  ) {
    super(message);
    this.name = "MapsApiError";
  }
}

interface GoogleStatusBody {
  status?: string;
  error_message?: string;
}

async function getJson<T extends GoogleStatusBody>(
  path: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  if (!hasMapsKey()) {
    throw new MapsApiError(
      "MISSING_KEY",
      "Address search is not configured in this build.",
    );
  }
  const qs = new URLSearchParams({ ...params, key: KEY }).toString();
  const res = await fetch(`${BASE}/${path}?${qs}`, { signal });
  if (!res.ok) {
    throw new MapsApiError(
      `HTTP_${res.status}`,
      "Address service unavailable.",
    );
  }
  const body = (await res.json()) as T;
  const status = body.status ?? "OK";
  if (status !== "OK" && status !== "ZERO_RESULTS") {
    throw new MapsApiError(
      status,
      body.error_message || `Address service error (${status}).`,
    );
  }
  return body;
}

// ─── Places Autocomplete ────────────────────────────────────────────────────

interface AutocompleteBody extends GoogleStatusBody {
  predictions?: {
    place_id: string;
    description: string;
    structured_formatting?: { main_text?: string; secondary_text?: string };
  }[];
}

/** Pure: Google's prediction rows → ours, Ontario-only. */
export const parseAutocomplete = (body: AutocompleteBody): PlacePrediction[] =>
  ontarioOnly(
    (body.predictions ?? []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting?.main_text,
      secondaryText: p.structured_formatting?.secondary_text,
    })),
  );

const ontarioRectangle = () => {
  const { southWest: sw, northEast: ne } = ONTARIO_BOUNDS;
  return `rectangle:${sw.lat},${sw.lng}|${ne.lat},${ne.lng}`;
};

/**
 * Address predictions for what the rider has typed so far, restricted to
 * Canada and filtered to Ontario. `sessionToken` groups the keystrokes of one
 * search with the place lookup that follows, which is how Google bills it.
 */
export async function autocompletePlaces(
  input: string,
  sessionToken: string,
  signal?: AbortSignal,
): Promise<PlacePrediction[]> {
  const body = await getJson<AutocompleteBody>(
    "place/autocomplete/json",
    {
      input,
      components: "country:ca",
      locationbias: ontarioRectangle(),
      sessiontoken: sessionToken,
    },
    signal,
  );
  return parseAutocomplete(body);
}

// ─── Geocoding ──────────────────────────────────────────────────────────────

interface GeocodeBody extends GoogleStatusBody {
  results?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
  }[];
}

export interface GeocodedPlace extends LatLng {
  formattedAddress: string;
}

/** Pure: the first geocoding result, or null. */
export const parseGeocode = (body: GeocodeBody): GeocodedPlace | null => {
  const r = body.results?.[0];
  const loc = r?.geometry?.location;
  if (!r || !loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng))
    return null;
  return {
    lat: loc.lat,
    lng: loc.lng,
    formattedAddress: r.formatted_address ?? "",
  };
};

/** Coordinates for a chosen prediction. */
export async function geocodePlaceId(
  placeId: string,
  sessionToken?: string,
): Promise<GeocodedPlace | null> {
  const params: Record<string, string> = { place_id: placeId };
  if (sessionToken) params.sessiontoken = sessionToken;
  return parseGeocode(await getJson<GeocodeBody>("geocode/json", params));
}

/**
 * Street address for a GPS fix, in the same two-part form we store from a
 * prediction ("133 Weber St N, Waterloo"). Null when Google has nothing.
 */
export async function reverseGeocode(point: LatLng): Promise<string | null> {
  const body = await getJson<GeocodeBody>("geocode/json", {
    latlng: `${point.lat},${point.lng}`,
    result_type: "street_address|premise|route",
  });
  const place = parseGeocode(body);
  if (!place?.formattedAddress) return null;
  return cleanPredictionAddress(place.formattedAddress, 2);
}

// ─── Distance Matrix ────────────────────────────────────────────────────────

interface DistanceMatrixBody extends GoogleStatusBody {
  rows?: { elements?: { status?: string; distance?: { value: number } }[] }[];
}

/**
 * Pure: driving distance in km, rounded once to one decimal so the stored
 * distance and the priced distance are the same number. Null when Google
 * cannot route the pair.
 */
export const parseDistanceKm = (body: DistanceMatrixBody): number | null => {
  const el = body.rows?.[0]?.elements?.[0];
  if (!el || el.status !== "OK" || !el.distance) return null;
  return parseFloat((el.distance.value / 1000).toFixed(1));
};

export async function drivingDistanceKm(
  from: LatLng,
  to: LatLng,
  signal?: AbortSignal,
): Promise<number | null> {
  const body = await getJson<DistanceMatrixBody>(
    "distancematrix/json",
    {
      origins: `${from.lat},${from.lng}`,
      destinations: `${to.lat},${to.lng}`,
      mode: "driving",
    },
    signal,
  );
  return parseDistanceKm(body);
}

/** A fresh Places session token (any unguessable string works). */
export const newSessionToken = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
