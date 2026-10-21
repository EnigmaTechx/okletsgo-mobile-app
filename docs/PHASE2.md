# Phase 2 — Rider booking, live rides and trips

Everything a rider does in the Ionic app, on the same Firestore documents
and Cloud Functions. Nothing changes server-side.

## What landed

| Area | Screen(s) | Ionic source |
| --- | --- | --- |
| Home | `(client)/index` | `pages/client/Home.tsx` + `ClientTrips.tsx` |
| Booking wizard | `(ride)/book/{locations,schedule,driver,confirm,success}` | `ride-wizard/Step1…Step4`, `BookingSuccess` |
| Live ride | `(ride)/live/[id]` | `RideStatusPage` + `ClientRideStatus` |
| Trips (history) | `(client)/trips`, `(common)/history/[id]` | `RideHistory`, `RideHistoryDetail` |
| Saved addresses | `(ride)/places`, `(ride)/places/edit` | `SavedAddresses`, `AddEditAddress` |
| Coupons | `(client)/rewards` | `Coupons` |

Shared pieces: `components/map/RideMap` (one map for booking, preview and
live), `components/rides/*` (trip cards, status panel, rating / outcome
dialogs, cancel and time-change sheets), `components/ui/{Sheet,Dialog,Toast,
SegmentedControl,DateTimeField,IconButton}`.

## Native modules added (prebuild needed)

| Package | Why |
| --- | --- |
| `react-native-maps` 1.27.2 | Google Maps on Android, Apple Maps on iOS |
| `expo-location` | "Use current location" pickup and the rider's dot on the live map |
| `@react-native-community/datetimepicker` | Pickup date and time |
| `expo-clipboard` | Copy a coupon code |

After pulling: `npm install`, then `npx expo prebuild --platform android --clean`
and `npx expo run:android`.

## Google Maps Platform setup (one-time)

The app calls three Google web services directly, the same three the Ionic
app reaches through the Maps JavaScript SDK, so fares keep pricing the same
Google driving distance:

- **Places API** (autocomplete, legacy endpoint the JS SDK uses)
- **Geocoding API** (place → coordinates, GPS → address)
- **Distance Matrix API** (driving distance for the fare)

Plus the **Maps SDK for Android** for the map itself (iOS uses Apple Maps,
no key).

1. In Google Cloud → APIs & Services → Credentials, create a key for the
   mobile app (or reuse one **without HTTP-referrer restrictions**; the web
   key used by the Ionic build is referrer-restricted and will be rejected
   with `REQUEST_DENIED`). Restrict it by API to the four above.
2. Put it in `.env` as `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=…` (see
   `.env.example`; `.env` is git-ignored). This value is inlined into the JS
   bundle, so API restriction is what protects it.
3. Optional but recommended for release: a second key restricted to the
   Android app (package `com.enigmatech.rideshare` + the upload keystore
   SHA-1) in `GOOGLE_MAPS_ANDROID_API_KEY`. It is baked into the Android
   manifest by `app.config.ts`. Falls back to the public key when unset.
4. On EAS, add both as project environment variables (secret), same names.

Without a key the Trip details screen shows a red banner and address
search returns nothing; the rest of the app still runs.

## Route lines and ETAs

Road geometry and live ETAs come from the public OSRM server
(`router.project-osrm.org`), exactly as the Ionic app's
leaflet-routing-machine and its ETA fetch do. It is best-effort: when it is
unreachable the map shows pins without a line and the ETA falls back to a
straight-line estimate at 40 km/h. Fares never depend on it.

## Navigation shape

- `(ride)` is a stack guarded for clients only, opened over the tabs. The
  booking steps share a `BookingProvider` draft instead of route params.
- After booking, the confirmation step calls `router.dismissAll()` then
  replaces itself with the success screen, so the success screen is the
  only screen in the stack: back lands on Home, never on a finished step.
- `(common)/history/[id]` serves both roles (drivers see their payout).

## Behaviour carried over from Ionic

- Ontario-only predictions; stored address is the first two comma parts.
- Distance is rounded once (one decimal) before pricing, so the stored
  `distance` and `estimatedPrice` agree; `estimatedPrice` is the full fare
  and the platform absorbs coupon discounts.
- Coupon is previewed with `validateCoupon` and locked in with
  `redeemCoupon` after the ride is created; if that fails the ride stays at
  full price and the rider is told.
- Driver photo and plate are revealed only from `heading_to_pickup` on.
- Rating nudge once per session for the latest unrated trip (3-day window);
  ride-outcome notice (declined / driver-cancelled / expired) once per ride.
- The v1.3.7 "fresh start" notice is not ported; it concerned accounts
  created before Sept 27 2026 and has run its course.

## Not in this phase

- Stripe card vault at confirmation (phase 5, behind `FEATURES.STRIPE_PAYMENTS`).
- Push notifications (phase 3).
- Welcome gift and km rewards on the Rewards tab (phase 4).
