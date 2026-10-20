import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Driver-only: app-level consent to share live location in the background
 * during a trip. The active-trip screen (phase 3) shows the prominent
 * disclosure and asks the OS for permission only after this is granted;
 * the Account tab lets a driver who tapped "Not now" turn it back on.
 */
export const BG_LOCATION_CONSENT_KEY = "okletsgo.bgLocationConsent";

export function useBgLocationConsent(): {
  granted: boolean | null;
  setGranted: (value: boolean) => void;
} {
  const [granted, setGrantedState] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(BG_LOCATION_CONSENT_KEY)
      .then((v) => {
        if (!cancelled) setGrantedState(v === "granted");
      })
      .catch(() => {
        if (!cancelled) setGrantedState(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setGranted = (value: boolean) => {
    setGrantedState(value);
    const op = value
      ? AsyncStorage.setItem(BG_LOCATION_CONSENT_KEY, "granted")
      : AsyncStorage.removeItem(BG_LOCATION_CONSENT_KEY);
    op.catch(() => undefined);
  };

  return { granted, setGranted };
}
