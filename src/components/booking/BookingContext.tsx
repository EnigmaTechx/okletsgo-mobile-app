import React, { createContext, useContext, useMemo, useState } from "react";
import type { UserProfile } from "../../interfaces/user";
import type { PlaceInput } from "../../services/bookingService";

/**
 * The booking wizard's working state, shared by its four steps instead of
 * being threaded through route params: addresses and quote (step 1),
 * pickup time (step 2), driver (step 3). `reset()` starts a fresh booking.
 */
export interface BookingDraft {
  pickup: PlaceInput | null;
  destination: PlaceInput | null;
  distanceKm: number | null;
  fare: number | null;
  scheduledForIso: string | null;
  driver: UserProfile | null;
}

const EMPTY: BookingDraft = {
  pickup: null,
  destination: null,
  distanceKm: null,
  fare: null,
  scheduledForIso: null,
  driver: null,
};

interface BookingContextValue {
  draft: BookingDraft;
  update: (patch: Partial<BookingDraft>) => void;
  reset: () => void;
}

const BookingContext = createContext<BookingContextValue>({
  draft: EMPTY,
  update: () => undefined,
  reset: () => undefined,
});

export const useBooking = () => useContext(BookingContext);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<BookingDraft>(EMPTY);
  const value = useMemo<BookingContextValue>(
    () => ({
      draft,
      update: (patch) => setDraft((d) => ({ ...d, ...patch })),
      reset: () => setDraft(EMPTY),
    }),
    [draft],
  );
  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}
