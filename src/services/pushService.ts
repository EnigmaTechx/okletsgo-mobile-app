import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  AuthorizationStatus,
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  registerDeviceForRemoteMessages,
  requestPermission,
  setBackgroundMessageHandler,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import { httpsCallable } from "@react-native-firebase/functions";
import { functions } from "./firebase";

/**
 * Push notifications, the same shape as the Ionic app: FCM token registered
 * through the registerFcmToken function (which also detaches the token from
 * any other account), background pushes displayed by the OS on the
 * "ride_updates" channel the Cloud Functions name, foreground pushes
 * re-shown as local banners, and taps routed by rideId.
 */

export const RIDE_UPDATES_CHANNEL = "ride_updates";

const messaging = getMessaging();

// Data-only messages while backgrounded: nothing to do, the functions send
// notification messages the OS shows itself. Registered once at import.
setBackgroundMessageHandler(messaging, async () => undefined);

// Foreground local banners: show them like the Ionic heads-up ones.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(RIDE_UPDATES_CHANNEL, {
    name: "Ride Updates",
    description: "Notifications about your ride status",
    importance: Notifications.AndroidImportance.MAX,
    // No `sound`: the system default. A string here names a bundled custom
    // sound file, and "default" is not one.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/** Ask for permission (iOS prompt, Android 13+ prompt). */
async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  }
  const status = await requestPermission(messaging);
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Permission, channel, token, and the server-side registration. Safe to
 * call on every sign-in; FCM returns the same token until it rotates.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    if (!(await ensurePermission())) {
      console.warn("User opted out of push notifications.");
      return null;
    }
    await ensureChannel();
    if (Platform.OS === "ios") await registerDeviceForRemoteMessages(messaging);
    const token = await getToken(messaging);
    if (!token) return null;
    await httpsCallable(functions, "registerFcmToken")({ token });
    return token;
  } catch (err) {
    console.error("Push registration failed:", err);
    return null;
  }
}

/** On sign-out: this device stops receiving the old account's pushes. */
export async function forgetPushToken(): Promise<void> {
  try {
    await deleteToken(messaging);
  } catch (err) {
    console.warn("Could not delete the FCM token:", err);
  }
}

export interface PushData {
  rideId?: string;
  type?: string;
}

const dataOf = (m: RemoteMessage | null | undefined): PushData => {
  const d = (m?.data ?? {}) as Record<string, unknown>;
  return {
    rideId: typeof d.rideId === "string" ? d.rideId : undefined,
    type: typeof d.type === "string" ? d.type : undefined,
  };
};

/**
 * Taps already routed, so the "which notification opened the app" APIs
 * cannot replay one. Both keep answering with the same notification for
 * as long as the task lives: Android re-delivers the launch intent when it
 * recreates the activity (returning from another app after the process was
 * dropped), and expo's last response is simply the last tap ever made. Each
 * tap is routed once, by id, across launches.
 */
const HANDLED_KEY = "okletsgo.handledPushIds";
const HANDLED_MAX = 20;

async function claimTap(id: string | undefined): Promise<boolean> {
  if (!id) return true;
  try {
    const raw = await AsyncStorage.getItem(HANDLED_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (ids.includes(id)) return false;
    ids.push(id);
    await AsyncStorage.setItem(
      HANDLED_KEY,
      JSON.stringify(ids.slice(-HANDLED_MAX)),
    );
  } catch {
    // Storage trouble: route rather than swallow a real tap.
  }
  return true;
}

const remoteId = (m: RemoteMessage): string | undefined =>
  m.messageId ??
  (m.sentTime ? `${dataOf(m).rideId ?? "?"}:${m.sentTime}` : undefined);

const localId = (r: Notifications.NotificationResponse): string =>
  `local:${r.notification.request.identifier}`;

let coldStartChecked = false;

/**
 * Wire up the three app states. Returns an unsubscribe.
 *  - foreground: the push arrives as data; re-show it as a local banner
 *    (trip reminders are skipped: the driver is already in the app),
 *  - background tap / cold start: `onOpen` with the ride id.
 */
export function listenForPushes(onOpen: (data: PushData) => void): () => void {
  const subs: (() => void)[] = [];

  subs.push(
    onMessage(messaging, async (message) => {
      const data = dataOf(message);
      if (data.type === "trip_reminder") return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.notification?.title ?? "OK Let's Go",
          body: message.notification?.body ?? "You have a new update.",
          data: { ...data },
          sound: true,
        },
        trigger:
          Platform.OS === "android"
            ? { channelId: RIDE_UPDATES_CHANNEL }
            : null,
      });
    }),
  );

  let live = true;
  const openRemote = async (m: RemoteMessage | null) => {
    if (!m) return;
    const data = dataOf(m);
    if (!data.rideId) return;
    if ((await claimTap(remoteId(m))) && live) onOpen(data);
  };
  const openLocal = async (r: Notifications.NotificationResponse | null) => {
    const data = r?.notification.request.content.data as PushData | undefined;
    if (!r || !data?.rideId) return;
    if ((await claimTap(localId(r))) && live) onOpen(data);
  };

  // Tap on a foreground banner we scheduled.
  const response = Notifications.addNotificationResponseReceivedListener(
    (r) => void openLocal(r),
  );
  subs.push(() => response.remove());

  // Tap on an OS-displayed push while backgrounded.
  subs.push(onNotificationOpenedApp(messaging, (m) => void openRemote(m)));

  // Cold start from a push: asked once per process (a remount, e.g. after
  // the profile reloads, is not a launch) and routed once per tap.
  if (!coldStartChecked) {
    coldStartChecked = true;
    getInitialNotification(messaging)
      .then(openRemote)
      .catch(() => undefined);
    Notifications.getLastNotificationResponseAsync()
      .then(openLocal)
      .catch(() => undefined);
  }

  subs.push(() => {
    live = false;
  });
  return () => subs.forEach((u) => u());
}
