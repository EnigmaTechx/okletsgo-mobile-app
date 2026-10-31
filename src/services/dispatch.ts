import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";
import { db, functions } from "./firebase";

/**
 * Dispatch: riders book through one dispatcher (Andy), who accepts, assigns
 * or declines each request. Settings live in config/dispatch (readable by
 * anyone, written only through the updateDispatchSettings function).
 */

export type FallbackAction = "assign_next" | "keep_waiting" | "remind";

export interface DispatchConfig {
  enabled?: boolean;
  /** Live dispatcher (Andy). */
  dispatcherId?: string;
  /** A test driver who plays the dispatcher for sandbox (test) riders. */
  testDispatcherId?: string;
  /** List the dispatcher to riders even while offline (default on). */
  showWhenOffline?: boolean;
  fallbackMinutes?: number;
  fallbackAction?: FallbackAction;
  /** An assigned driver's "Can't take it" returns the ride (default on). */
  returnToDispatcher?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

/** The dispatcher a rider books through, or null when dispatch is off. */
export const dispatcherFor = (
  cfg: DispatchConfig | null,
  isTest: boolean,
): string | null => {
  if (!cfg?.enabled) return null;
  return (isTest ? cfg.testDispatcherId : cfg.dispatcherId) || null;
};

const configRef = () => doc(db, "config", "dispatch");

/** One-off read; any failure means "dispatch off" so booking never breaks. */
export async function fetchDispatchConfig(): Promise<DispatchConfig> {
  try {
    const snap = await getDoc(configRef());
    return (snap.data() as DispatchConfig | undefined) ?? {};
  } catch (e) {
    console.warn("[dispatch] config unavailable, treating as off", e);
    return {};
  }
}

/** Live config for the admin's Dispatch page. */
export function useDispatchConfig(): {
  config: DispatchConfig | null;
  error: boolean;
} {
  const [config, setConfig] = useState<DispatchConfig | null>(null);
  const [error, setError] = useState(false);
  useEffect(
    () =>
      onSnapshot(
        configRef(),
        (snap) => setConfig((snap.data() as DispatchConfig | undefined) ?? {}),
        () => setError(true),
      ),
    [],
  );
  return { config, error };
}

type AssignPayload = { rideId: string; toDriverId: string; note: string };
type AssignResult = { driverFirstName: string };

/** Dispatcher only: hand a pending ride to another driver. */
export async function assignRide(
  rideId: string,
  toDriverId: string,
  note: string,
): Promise<string> {
  const fn = httpsCallable<AssignPayload, AssignResult>(
    functions,
    "assignRide",
  );
  const res = await fn({ rideId, toDriverId, note });
  return res.data.driverFirstName;
}

/** Dispatcher: move an accepted (not started) ride to another driver, or back to himself. */
export async function reassignRide(
  rideId: string,
  toDriverId: string,
  note: string,
): Promise<string> {
  const fn = httpsCallable<AssignPayload, AssignResult>(
    functions,
    "reassignRide",
  );
  const res = await fn({ rideId, toDriverId, note });
  return res.data.driverFirstName;
}

export type DispatchPatch = Partial<
  Omit<DispatchConfig, "dispatcherId" | "testDispatcherId">
> & {
  dispatcherId?: string | null;
  testDispatcherId?: string | null;
};

/** Owner only: change config/dispatch (validated server-side). */
export async function updateDispatchSettings(
  patch: DispatchPatch,
): Promise<void> {
  const fn = httpsCallable(functions, "updateDispatchSettings");
  await fn(patch);
}

/** Message from a callable error, for alerts and toasts. */
export const callableMessage = (err: unknown, fallback: string): string => {
  const e = err as { message?: string };
  return e?.message || fallback;
};
