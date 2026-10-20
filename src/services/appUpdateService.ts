import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Application from "expo-application";
import { doc, onSnapshot } from "@react-native-firebase/firestore";
import { db } from "./firebase";

/**
 * Minimum-version gate.
 *
 * Reads the public `config/app` document and, when this build is older than
 * the minimum for its platform, the root layout shows a full-screen "Update
 * required" page instead of the app. This is also the lever that retires the
 * Ionic app: once the React Native build is live, raising `minBuild` past the
 * last Ionic build (33) sends every old install to the store.
 *
 * Firestore document `config/app`:
 *   {
 *     minBuild:  { android: 34, ios: 34 },
 *     storeUrl:  { android: "https://play.google.com/store/apps/details?id=com.enigmatech.rideshare",
 *                  ios:     "https://apps.apple.com/app/id6760600607" },
 *     message:   "optional custom sentence shown under the title"
 *   }
 *
 * Fails open: no document, a read error, or a build we can't determine never
 * blocks the app. The listener is live, so raising minBuild in the admin
 * dashboard takes effect on every running app within seconds.
 */

export interface AppUpdateConfig {
  minBuild?: { android?: number; ios?: number };
  storeUrl?: { android?: string; ios?: string };
  message?: string;
}

export const DEFAULT_STORE_URL: Record<string, string> = {
  android:
    "https://play.google.com/store/apps/details?id=com.enigmatech.rideshare",
  ios: "https://apps.apple.com/app/id6760600607",
};

export interface UpdateGateState {
  /** True only when this build is below the configured minimum. */
  updateRequired: boolean;
  /** Where to send the user (platform store, overridable from config). */
  storeUrl: string;
  /** Optional custom message from config. */
  message?: string;
  /** This build's number, for display ("You have build 4"). */
  currentBuild: number | null;
  minBuild: number | null;
}

const toInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : null;
};

/** The native build number (Android versionCode / iOS CFBundleVersion). */
export const currentBuildNumber = (): number | null =>
  toInt(Application.nativeBuildVersion);

/** Pure gate decision, exported for tests. */
export function evaluateUpdateGate(
  platform: string,
  currentBuild: number | null,
  config: AppUpdateConfig | null,
): UpdateGateState {
  const isMobile = platform === "android" || platform === "ios";
  const minBuild = isMobile ? toInt(config?.minBuild?.[platform]) : null;
  const storeUrl =
    (isMobile ? config?.storeUrl?.[platform] : undefined) ||
    DEFAULT_STORE_URL[platform] ||
    DEFAULT_STORE_URL.android;
  const updateRequired =
    currentBuild !== null && minBuild !== null && currentBuild < minBuild;
  return {
    updateRequired,
    storeUrl,
    message: config?.message,
    currentBuild,
    minBuild,
  };
}

export function useUpdateGate(): UpdateGateState {
  const [config, setConfig] = useState<AppUpdateConfig | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return; // dev/preview only — never gate
    const unsub = onSnapshot(
      doc(db, "config", "app"),
      (snap) =>
        setConfig(snap.exists() ? (snap.data() as AppUpdateConfig) : null),
      (err) => {
        console.warn("[updateGate] config/app unavailable — not gating", err);
        setConfig(null);
      },
    );
    return unsub;
  }, []);

  return evaluateUpdateGate(Platform.OS, currentBuildNumber(), config);
}
