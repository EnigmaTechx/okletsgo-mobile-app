import { doc, getDoc, setDoc, onSnapshot } from "@react-native-firebase/firestore";
import { db } from "./firebase";

// A client's saved address (Home, Work, "Mom's House", …). Stored as an array
// on the user doc — small, bounded, owner-writable, so no extra rules or
// Cloud Functions are needed. lat/lng are captured at save time so picking a
// saved place at booking needs no geocoding round-trip.
export interface SavedPlace {
  id: string;
  label: string;
  address: string;
  lat: number;
  lng: number;
  createdAt: string;
}

/** Cap the list so the user doc stays small and the UI stays manageable. */
export const MAX_SAVED_PLACES = 15;

function newId(): string {
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Live subscription to a client's saved places (newest first). */
export function subscribeSavedPlaces(
  uid: string,
  cb: (places: SavedPlace[]) => void,
): () => void {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      const data = snap.data();
      const places = (data?.savedPlaces as SavedPlace[] | undefined) ?? [];
      cb([...places].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)));
    },
    (err) => {
      console.warn("Saved places listener failed:", err);
      cb([]);
    },
  );
}

async function readPlaces(uid: string): Promise<SavedPlace[]> {
  const snap = await getDoc(doc(db, "users", uid));
  return (snap.data()?.savedPlaces as SavedPlace[] | undefined) ?? [];
}

async function writePlaces(uid: string, places: SavedPlace[]): Promise<void> {
  await setDoc(doc(db, "users", uid), { savedPlaces: places }, { merge: true });
}

/** Add a new saved place. Returns the created record. */
export async function addSavedPlace(
  uid: string,
  input: Omit<SavedPlace, "id" | "createdAt">,
): Promise<SavedPlace> {
  const current = await readPlaces(uid);
  if (current.length >= MAX_SAVED_PLACES) {
    throw new Error(`You can save up to ${MAX_SAVED_PLACES} addresses.`);
  }
  const place: SavedPlace = { ...input, id: newId(), createdAt: new Date().toISOString() };
  await writePlaces(uid, [...current, place]);
  return place;
}

/** Re-insert a previously-removed place verbatim (for undo). */
export async function restoreSavedPlace(uid: string, place: SavedPlace): Promise<void> {
  const current = await readPlaces(uid);
  if (current.some((p) => p.id === place.id)) return;
  await writePlaces(uid, [...current, place]);
}

/** Update an existing saved place's label/address/coords. */
export async function updateSavedPlace(
  uid: string,
  id: string,
  patch: Partial<Omit<SavedPlace, "id" | "createdAt">>,
): Promise<void> {
  const current = await readPlaces(uid);
  await writePlaces(uid, current.map((p) => (p.id === id ? { ...p, ...patch } : p)));
}

/** Remove a saved place by id. */
export async function removeSavedPlace(uid: string, id: string): Promise<void> {
  const current = await readPlaces(uid);
  await writePlaces(uid, current.filter((p) => p.id !== id));
}

/** Fetch a single saved place by id (for the edit screen). */
export async function getSavedPlace(uid: string, id: string): Promise<SavedPlace | null> {
  const current = await readPlaces(uid);
  return current.find((p) => p.id === id) ?? null;
}
