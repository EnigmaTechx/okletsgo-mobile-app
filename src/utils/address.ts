/** Address and date/time display helpers shared by the ride screens. */

/** "133 Weber St N, Waterloo, ON" → "133 Weber St N". */
export const firstLine = (address?: string | null): string =>
  (address ?? "").split(",")[0].trim();

/** Split a full address into its street line and the rest. */
export const splitAddress = (
  full?: string | null,
): { main: string; sub: string } => {
  const s = (full ?? "").trim();
  const idx = s.indexOf(",");
  if (idx === -1) return { main: s, sub: "" };
  return { main: s.slice(0, idx).trim(), sub: s.slice(idx + 1).trim() };
};

/**
 * The address we store from a Places prediction: the first `parts` comma
 * segments ("Fairview Park Mall, Kitchener"), dropping province and country.
 * Matches the Ionic app so new and old rides read the same in history.
 */
export const cleanPredictionAddress = (
  description: string,
  parts = 2,
): string =>
  description
    .split(",")
    .slice(0, parts)
    .map((p) => p.trim())
    .filter(Boolean)
    .join(", ");

/** True when two points are the same spot or the same text. */
export const isSamePlace = (
  a: { address: string; lat: number; lng: number },
  b: { address: string; lat: number; lng: number },
): boolean =>
  (Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6) ||
  a.address.trim().toLowerCase() === b.address.trim().toLowerCase();

/** ["6:10", "PM"] for a trip row; ["—", ""] when the time is unusable. */
export const timeParts = (iso?: string | null): [string, string] => {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return ["—", ""];
  const s = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const [time, ampm] = s.split(" ");
  return [time, ampm ?? ""];
};

/** "6:10 PM" */
export const formatTime = (iso?: string | null): string => {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

/** { date: "October 21, 2026", time: "6:10 PM" } for confirmations. */
export const formatDateTime = (
  iso?: string | null,
): { date: string; time: string } => {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return { date: "…", time: "…" };
  return {
    date: d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: formatTime(iso),
  };
};

/** "Oct 21 · 6:10 PM" for list rows and headers. */
export const formatShortDateTime = (iso?: string | null): string => {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · ${formatTime(iso)}`;
};

/** "Oct 21, 6:10 PM" (the Ionic time-change wording). */
export const formatDayAndTime = (iso?: string | null): string => {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

/** Minutes between two ISO timestamps as "12 min" or "1h 05m"; null if unusable. */
export const durationLabel = (
  startIso?: string | null,
  endIso?: string | null,
): string | null => {
  if (!startIso || !endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
};
