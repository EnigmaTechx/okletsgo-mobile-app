import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "@react-native-firebase/firestore";
import { auth, db } from "./firebase";

// Record the app version/build/platform and a "last active" timestamp on the
// user's document so the admin can see which app versions are actively in use.
// The admin App Info page reads exactly these fields, so the React Native
// rollout shows up there as "2.x" climbing next to the Ionic "1.5.x".
// Best-effort: failures are swallowed so this never affects the app.
export async function recordAppTelemetry(uid: string): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      platform: Platform.OS,
      lastActiveAt: serverTimestamp(),
    };
    // Only write version/build when we actually have them, so a transient
    // failure never clobbers a previously-recorded value.
    if (Application.nativeApplicationVersion) {
      payload.appVersion = Application.nativeApplicationVersion;
    }
    if (Application.nativeBuildVersion) {
      payload.appBuild = Application.nativeBuildVersion;
    }
    await setDoc(doc(db, "users", uid), payload, { merge: true });
  } catch (error) {
    console.warn("Failed to record app telemetry", error);
  }
}

// Append a phone-auth / registration funnel event to the `authEvents`
// collection so sign-in problems can be diagnosed from the admin app, per
// device. Never blocks or breaks the auth flow. `userAgent` carries the device
// model (the Ionic app got it from the WebView UA; here it comes from
// expo-device) so device-specific failures stay visible on the same page.
//
// DURABILITY: a write that fails (poor network, app closed mid-write, the
// first instant after sign-in before the token is attached) is retried once
// after a short delay, and if it still fails it is queued in AsyncStorage and
// flushed on the next launch / auth change (flushPendingAuthEvents). Queued
// events keep their original time in `clientTime` and are marked `queued`.

const PENDING_KEY = "okletsgo.pendingAuthEvents";
const PENDING_MAX = 20;

type AuthEventPayload = Record<string, unknown> & {
  event: string;
  clientTime: string;
};

const readPending = async (): Promise<AuthEventPayload[]> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as AuthEventPayload[]) : [];
  } catch {
    return [];
  }
};

const writePending = async (list: AuthEventPayload[]) => {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(PENDING_KEY);
    else
      await AsyncStorage.setItem(
        PENDING_KEY,
        JSON.stringify(list.slice(-PENDING_MAX)),
      );
  } catch {
    /* storage unavailable — nothing more we can do */
  }
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const writeEvent = (payload: AuthEventPayload, queued: boolean) =>
  addDoc(collection(db, "authEvents"), {
    ...payload,
    queued,
    createdAt: serverTimestamp(),
  });

/** "Pixel 8 Pro (android)" / "iPhone 15 (ios)" for diagnostics and support mail. */
export const deviceDescription = (): string =>
  `${Device.modelName ?? "unknown device"} (${Platform.OS})`;

/** "2.0.0 (34)" for the support email; empty when unknown. */
export const appVersionLabel = (): string =>
  Application.nativeApplicationVersion
    ? `${Application.nativeApplicationVersion} (${Application.nativeBuildVersion ?? "?"})`
    : "";

export async function logAuthEvent(
  event: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const payload: AuthEventPayload = {
    event,
    platform: Platform.OS,
    appVersion: Application.nativeApplicationVersion ?? null,
    appBuild: Application.nativeBuildVersion ?? null,
    userAgent: Device.modelName ?? null,
    uid: auth.currentUser?.uid ?? null,
    clientTime: new Date().toISOString(),
    ...extra,
  };

  try {
    await writeEvent(payload, false);
    return;
  } catch (first) {
    console.warn("Auth event write failed, retrying once", first);
  }

  // Second attempt after a beat — covers the "token not yet attached" race
  // right after sign-in and a momentary network blip.
  await sleep(1500);
  try {
    await writeEvent(payload, false);
  } catch (second) {
    console.warn(
      "Auth event write failed again — queued for next launch",
      second,
    );
    await writePending([...(await readPending()), payload]);
  }
}

// Flush events that couldn't be written earlier. Called on app start and on
// every auth-state change (a good moment: the token, if any, is fresh).
// Events that still fail stay queued for the next attempt.
let flushing = false;
export async function flushPendingAuthEvents(): Promise<void> {
  if (flushing) return;
  const pending = await readPending();
  if (pending.length === 0) return;
  flushing = true;
  const stillPending: AuthEventPayload[] = [];
  try {
    for (const payload of pending) {
      try {
        await writeEvent(payload, true);
      } catch {
        stillPending.push(payload);
      }
    }
  } finally {
    await writePending(stillPending);
    flushing = false;
  }
}
