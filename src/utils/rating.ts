/**
 * Display form for a driver's average rating. Drivers with no ratings yet show
 * as "New" (Uber/Lyft convention) rather than a misleading default like 5.0.
 */
export function formatDriverRating(rating?: number | null): string {
  return typeof rating === "number" && rating > 0 ? rating.toFixed(1) : "New";
}
