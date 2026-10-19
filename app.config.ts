import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Dynamic config on top of app.json.
 *
 * The two Firebase config files are not committed. On EAS they arrive as file
 * secrets exposed through these environment variables; locally, drop the real
 * files next to this file (both are git-ignored) and the fallback paths in
 * app.json apply. See docs/PHASE0.md.
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? "OK Let's Go",
  slug: config.slug ?? "okletsgo",
  ios: {
    ...config.ios,
    googleServicesFile: process.env.GOOGLE_SERVICES_PLIST ?? config.ios?.googleServicesFile,
  },
  android: {
    ...config.android,
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
  },
});
