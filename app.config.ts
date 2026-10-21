import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic config on top of app.json.
 *
 * Secrets never live in app.json. On EAS they arrive as secrets exposed
 * through these environment variables; locally they come from `.env` (see
 * `.env.example`) or files dropped next to this one (git-ignored).
 *
 * - GOOGLE_SERVICES_JSON / GOOGLE_SERVICES_PLIST: paths to the Firebase
 *   native config files (docs/PHASE0.md).
 * - GOOGLE_MAPS_ANDROID_API_KEY: the Maps SDK for Android key baked into the
 *   manifest. Falls back to EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, the key the JS
 *   side uses for Places, Geocoding and Distance Matrix (docs/PHASE2.md).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "OK Let's Go",
  slug: config.slug ?? "okletsgo",
  ios: {
    ...config.ios,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_PLIST ?? config.ios?.googleServicesFile,
  },
  android: {
    ...config.android,
    googleServicesFile:
      process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey:
          process.env.GOOGLE_MAPS_ANDROID_API_KEY ??
          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ??
          config.android?.config?.googleMaps?.apiKey ??
          "",
      },
    },
  },
});
