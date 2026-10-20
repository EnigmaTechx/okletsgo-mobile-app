# Phase 0 — Foundation

What this phase delivers, what is already done in the repo, and the handful of
steps that can only be done by a person with the accounts (Expo, Firebase,
Google Play, Apple). The phase 0 gate is: **a development build on one Android
phone and one iPhone signs in with a real phone number and lands on the right
tab shell.**

## Done in the repo

| Area | Where | Notes |
| --- | --- | --- |
| App identity | `app.json` | `com.enigmatech.rideshare` on both platforms, version 2.0.0, scheme `okletsgo`, the real icon, adaptive icon and logo splash from the Ionic repo |
| Native Firebase | `src/services/firebase.ts`, `app.json` plugins | `@react-native-firebase` app/auth/firestore/functions/messaging/storage with the config plugins and `useFrameworks: static` for iOS |
| Firebase config files | `app.config.ts` | Read from `GOOGLE_SERVICES_JSON` / `GOOGLE_SERVICES_PLIST` (EAS file secrets) or from the repo root locally; both are git-ignored |
| Design tokens | `src/theme/tokens.ts` | Light and dark palettes, type scale (Manrope), spacing, radii |
| Theme | `src/contexts/ThemeContext.tsx` | System / light / dark, stored per device, toggle on the Account tab |
| Route groups | `src/app/(auth)`, `(client)`, `(driver)`, `admin` | Expo Router with `Stack.Protected` guards in the root layout; placeholders say which phase fills them |
| Sign-in | `(auth)/login.tsx`, `(auth)/otp.tsx`, `src/services/authService.ts` | Phone + SMS code on native Firebase; OTP session resume and the registration-in-progress guard moved to SecureStore |
| Registration | `(auth)/role-select.tsx`, `complete-profile.tsx`, `driver-vehicle-info.tsx` | Same profile document shape the Ionic app writes |
| Shared state | `AuthContext`, `FeatureFlagsContext`, pricing listener, `config/app` update gate | Ported with the same behaviour; the update gate is the Ionic sunset lever |
| Ported as-is | `src/interfaces`, `src/utils`, `src/config`, service files | Import paths changed to `@react-native-firebase/*`; everything else untouched |
| Tests | `npx jest` | The Vitest suites now run under Jest (34 tests), plus the update gate, pricing coercion and Places filters |
| CI | `.github/workflows/ci.yml` | Lint, typecheck, Jest on every PR to `dev`/`main`; an EAS development build job that turns on with a repository variable |

## To do by hand (needs the accounts)

1. **Expo account and EAS project.** `npx eas-cli login`, then `npx eas-cli init` in this repo. It writes `extra.eas.projectId` and `owner` into `app.json`; commit that change.
2. **Firebase config files.** In the Firebase console, the existing Android app (`com.enigmatech.rideshare`) and iOS app (same id) already exist from the Ionic build. Download `google-services.json` and `GoogleService-Info.plist` from Project settings and:
   - locally: drop them in the repo root (git-ignored) for `npx expo run:android` / `run:ios`;
   - on EAS: `eas secret:create --scope project --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json` and the same for `GOOGLE_SERVICES_PLIST`. `app.config.ts` reads these names.
3. **Android signing.** Export the upload key from the Ionic keystore and upload it: `eas credentials --platform android` → use existing keystore. Then add the keystore's SHA-256 (and SHA-1) fingerprint to the Firebase Android app so phone auth's Play Integrity check passes, and re-download `google-services.json` afterwards.
4. **iOS signing.** `eas credentials --platform ios` with the Apple team that owns App ID 6760600607. Enable Push Notifications on the identifier (phone auth uses silent APNs; messaging needs it in phase 3) and upload the APNs auth key to Firebase → Cloud Messaging.
5. **Build numbers.** Versions live in `app.json` (`appVersionSource: local`): `android.versionCode` and `ios.buildNumber` start at 35, above the last Ionic build, so a local `expo run:android` installs over the live app instead of failing with `INSTALL_FAILED_VERSION_DOWNGRADE`. Bump both by one for every store submission, the way `release:prep` did in the Ionic repo. A debug build can only replace an app signed with the same key: on a phone carrying the Play Store build, uninstall it first (all data is in Firestore) or install the EAS build, which uses the upload key.
6. **Development builds.** `eas build --profile development --platform all`. Install on one Android phone and one iPhone, run `npx expo start --dev-client`, sign in with an existing client and an existing driver account. That is the gate.
7. **CI builds (optional).** Add `EXPO_TOKEN` as a repository secret and set the repository variable `EAS_BUILDS_ENABLED=true` to get a development build on every merge to `dev`.

## Decisions baked in

- In-place update of the existing store listings (same identifiers and signing). Riders will sign in once more after the update because the Ionic webview session does not carry over.
- No Expo Go: native Firebase, maps, Stripe and background location all need a development build.
- Light and dark mode both ship; the default follows the system.
- The welcome gift is "first ride free up to 10 km" (Andy, 19 Oct 2026); the promotions work in phase 4 uses that wording and a distance cap rather than a dollar cap.

## Not in this phase

Maps, booking, live trips, background location, push notifications, payments, photo upload and the admin pages. Each has a placeholder screen that names its phase.
