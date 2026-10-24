# Phase 3 — Driver parity

The driver's side of the same ride, on the same Firestore fields and Cloud
Functions as the Ionic app. Nothing changes server-side.

## What landed

| Area                              | Screen / module                                                    | Ionic source                                                     |
| --------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Dashboard                         | `(driver)/index`                                                   | `pages/driver/Dashboard.tsx` + `DashboardTrips.tsx`              |
| Ride page (request + active trip) | `(drive)/ride/[id]` with `IncomingRequestPanel`, `ActiveRidePanel` | `DriverRideDetails`, `IncomingRequestCard`, `ActiveRideControls` |
| Time-change review                | `components/drive/TimeChangeReviewCard`                            | `TimeChangeReviewCard`                                           |
| Background location               | `services/backgroundLocation.ts`                                   | `@capacitor-community/background-geolocation` watcher            |
| Push notifications                | `services/pushService.ts`, `components/PushNotifications.tsx`      | `hooks/useAppPermissions.ts`                                     |
| Trips (history)                   | `(driver)/trips` via the shared `TripsHistory`                     | `RideHistory`                                                    |
| Earnings                          | `(driver)/earnings` (flag `driver_earnings`)                       | `DriverEarnings`                                                 |
| Vehicle change                    | `(drive)/vehicle`                                                  | `DriverProfileSettings` (vehicle section)                        |

## Native modules added (prebuild needed)

| Package                                                             | Why                                                      |
| ------------------------------------------------------------------- | -------------------------------------------------------- |
| `@react-native-firebase/messaging` (was a dependency; now a plugin) | FCM token and push delivery                              |
| `expo-notifications`                                                | "ride_updates" channel, foreground banners, tap handling |
| `expo-task-manager`                                                 | the background location task                             |
| `expo-location` (background options turned on)                      | foreground service on Android, "Always" on iOS           |
| `expo-keep-awake`                                                   | screen stays on while online                             |

After pulling: `npm install`, then `npx expo prebuild --platform android --clean`
and `npx expo run:android`. `plugins/withMessagingManifestFix.js` (listed
just before `expo-notifications` in `app.json`) marks the FCM channel and
colour meta-data with `tools:replace`; without it the manifest merger
rejects the duplicate entries from the messaging library. Android 13+ asks for notification permission on
first sign-in; Android 10+ asks for background location only after the
in-app disclosure is accepted on the first trip.

## Trip flow (unchanged from Ionic)

1. A new request opens `(drive)/ride/[id]` from the dashboard or a push.
   Accept calls `acceptRide`; Decline calls `declineRide` with a reason (the
   function may forward the request to the next driver). A request more
   than 30 minutes past its pickup time can only be dismissed.
2. Accepted: slide **Head to pickup**. Locked until 45 minutes before the
   scheduled time (sandbox drivers skip the lock) and while another trip is
   live. Writes `status`, `headedToPickupAt`, `driverStartLocation`.
3. On the way: the foreground watcher writes `driverLocation` (throttled to
   25 m / 15 s). The **prominent disclosure** appears first; on Allow, the
   OS background-permission prompt follows and the background task starts
   (foreground service notification on Android). "Not now" keeps foreground
   updates only. Consent is remembered (`okletsgo.bgLocationConsent`) and
   can be changed on the Account tab.
4. Slide **Arrived at pickup**: 5-minute wait timer, then the no-show cancel
   unlocks 5 minutes after the scheduled pickup (whichever is later).
5. Slide **Start trip**, then **Complete trip**. More than 300 m from the
   drop-off, the early-end sheet asks for a reason and the trip is repriced
   on the straight-line distance, never above the booked fare. Completion
   writes `totalKmTravelled` (trip + commute) and `tripCompletedAt`, then
   calls `completeRide`, which alone sets `status: completed`.
6. Cancel (⋮) goes through `cancelRide` with the driver's reason.

## Push notifications

- Token: `registerFcmToken` on every sign-in (the function detaches the
  token from any other account). On sign-out the token is deleted locally
  and cleared from the profile.
- Background pushes are shown by the OS on the `ride_updates` channel the
  functions name; foreground pushes are re-shown as local banners (trip
  reminders are skipped in the foreground, as before).
- A tap routes by the ride document: cancelled or completed → history;
  driver's ride → `(drive)/ride/[id]`; rider's ride → `(ride)/live/[id]`.
- Each tap is routed once: handled notification ids are kept in
  AsyncStorage, because `getInitialNotification` (Android re-delivers the
  launch intent whenever it recreates the activity) and
  `getLastNotificationResponseAsync` keep returning an old tap and would
  otherwise reopen a finished ride on every return to the app.
- iOS needs the APNs key uploaded to the Firebase project and the push
  capability on the App Store identifier; the messaging plugin adds the
  entitlement and background mode.

## Patched dependency

`patches/react-native-screens+4.26.2.patch` (applied by `patch-package` on
`postinstall`) carries one upstream Android fix: a header-config update on
a screen already detached from its stack threw
`IllegalStateException: ScreenStackFragment added into a non-stack
container` (react-native-screens issue 4429, fixed in 4.29.0). Expo SDK 57
pins `~4.26.0`; drop the patch once the SDK moves to 4.29 or later.

## Not in this phase

- Driver profile photo and vehicle photo (phase 5, with the rider's).
- Earnings & Payouts prototype page (`driver_payouts`, phase 5).
- Background checks (parked).
