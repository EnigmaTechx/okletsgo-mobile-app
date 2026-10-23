const { withAndroidManifest } = require("expo/config-plugins");

/**
 * expo-notifications writes the FCM default channel / colour / icon
 * meta-data into the app manifest, and @react-native-firebase/messaging's
 * library manifest declares the same keys with other values. The manifest
 * merger refuses the conflict unless our entries say tools:replace.
 * Listed just BEFORE expo-notifications in app.json: later plugins run
 * first, so this one sees the entries expo-notifications adds.
 */
const KEYS = {
  "com.google.firebase.messaging.default_notification_channel_id": "android:value",
  "com.google.firebase.messaging.default_notification_color": "android:resource",
  "com.google.firebase.messaging.default_notification_icon": "android:resource",
};

module.exports = function withMessagingManifestFix(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const app = manifest.application?.[0];
    for (const item of app?.["meta-data"] ?? []) {
      const name = item.$?.["android:name"];
      const attr = name && KEYS[name];
      if (attr) item.$["tools:replace"] = attr;
    }
    return mod;
  });
};
