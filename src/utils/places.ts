// Ontario-only Places restriction.
//
// Places autocomplete only restricts down to the country (Canada), with no
// province filter. So the booking screens do two things:
//   1. bias predictions toward an Ontario bounding box (better relevance), and
//   2. strictly drop any prediction that isn't in Ontario.
// Combined, the client only ever sees Ontario addresses. These helpers are
// framework-free so the Places API (New) client in phase 2 and its tests can
// share them.

/** Rough bounding box covering Ontario (south-west / north-east corners). */
export const ONTARIO_BOUNDS = {
  southWest: { lat: 41.6, lng: -95.2 },
  northEast: { lat: 56.9, lng: -74.3 },
} as const;

/** The shape of a prediction the booking screens care about. */
export interface PlacePrediction {
  placeId: string;
  /** Full display text, e.g. "Conestoga Mall, King Street North, Waterloo, ON, Canada". */
  description: string;
  mainText?: string;
  secondaryText?: string;
}

/**
 * True when a prediction is in Ontario. Canadian addresses render the province
 * as ", ON" (e.g. "Toronto, ON, Canada"), and place-level results spell out
 * "Ontario" — we accept either.
 */
export function isOntarioPrediction(
  p: Pick<PlacePrediction, "description">,
): boolean {
  const desc = p.description || "";
  return /,\s*ON\b/i.test(desc) || /\bontario\b/i.test(desc);
}

/** Filter a prediction list down to Ontario-only results. */
export function ontarioOnly<T extends Pick<PlacePrediction, "description">>(
  preds: T[] | null | undefined,
): T[] {
  return (preds || []).filter(isOntarioPrediction);
}

/**
 * Display form for a prediction: drops the redundant trailing ", Canada" while
 * keeping the province (", ON") so the user still sees it's in Ontario.
 */
export function formatPredictionText(description: string): string {
  return description.replace(/,\s*Canada\s*$/i, "");
}
