import { useEffect, useState } from "react";
import {
  autocompletePlaces,
  geocodePlaceId,
  MapsApiError,
  newSessionToken,
} from "../services/googleMaps";
import { cleanPredictionAddress } from "../utils/address";
import type { PlacePrediction } from "../utils/places";

export interface PickedPlace {
  address: string;
  lat: number;
  lng: number;
}

interface Results {
  /** The trimmed query these results answer. */
  for: string;
  predictions: PlacePrediction[];
  error: string | null;
}

const NONE: Results = { for: "", predictions: [], error: null };

/**
 * Debounced Ontario address search for one text field. `pick()` resolves a
 * prediction to coordinates and the short stored address, and starts a new
 * Places billing session for the next search. `seed()` fills the field
 * with a known address without searching for it.
 */
export function usePlaceSearch(addressParts = 2) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>(NONE);
  const [session, setSession] = useState(() => newSessionToken());

  const text = query.trim();
  const live = text.length >= 2;
  const fresh = results.for === text;
  const predictions = live && fresh ? results.predictions : [];
  const error = live && fresh ? results.error : null;
  const searching = live && !fresh;

  useEffect(() => {
    if (!live || fresh) return;
    const controller = new AbortController();
    const t = setTimeout(() => {
      autocompletePlaces(text, session, controller.signal)
        .then((preds) => {
          if (!controller.signal.aborted)
            setResults({ for: text, predictions: preds, error: null });
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          console.warn("Autocomplete failed:", err);
          setResults({
            for: text,
            predictions: [],
            error:
              err instanceof MapsApiError
                ? err.message
                : "Address search is unavailable right now.",
          });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [text, live, fresh, session]);

  /** Show `address` in the field as settled text (no lookup). */
  const seed = (address: string) => {
    setQuery(address);
    setResults({ for: address.trim(), predictions: [], error: null });
  };

  const clear = () => seed("");

  const pick = async (p: PlacePrediction): Promise<PickedPlace | null> => {
    const address = cleanPredictionAddress(p.description, addressParts);
    seed(address);
    const geo = await geocodePlaceId(p.placeId, session);
    setSession(newSessionToken());
    if (!geo) return null;
    return { address, lat: geo.lat, lng: geo.lng };
  };

  return { query, setQuery, seed, predictions, searching, error, pick, clear };
}
