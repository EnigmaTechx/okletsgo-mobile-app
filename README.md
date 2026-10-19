# OK Let's Go — mobile app (React Native)

The new home of the OK Let's Go rider and driver app, rebuilt in Expo /
React Native on the same Firebase backend as the live Ionic app
(`rideshare-ionic-app`). It ships as an in-place update of the existing App
Store and Google Play listings under `com.enigmatech.rideshare`.

Migration plan, phases and the feature parity tracker live in the roadmap doc;
the per-phase notes live in `docs/`.

## Run it

```bash
npm install
# drop google-services.json and GoogleService-Info.plist in the repo root (see docs/PHASE0.md)
npx expo run:android      # or: npx expo run:ios
```

Expo Go cannot run this app (native Firebase, maps, background location). Use
a development build: `eas build --profile development`.

## Check it

```bash
npx expo lint        # ESLint (eslint-config-expo)
npx tsc --noEmit     # TypeScript
npx jest             # unit tests
npx expo-doctor      # dependency and config sanity
```

## Layout

```
src/
  app/                  Expo Router routes
    (auth)/             onboarding, welcome, login, otp, role-select, complete-profile, driver-vehicle-info
    (client)/           Book · Trips · Rewards · Account tabs
    (driver)/           Home · Trips · Earnings · Account tabs
    admin/              product-owner section (app roles)
  components/           shared UI (ui/ = primitives: Screen, AppText, Button, TextField, Logo)
  contexts/             AuthContext, FeatureFlagsContext, ThemeContext
  services/             firebase, auth, pricing, rides, coupons, telemetry, update gate, stats
  config/               feature-flag catalogue, app roles
  interfaces/           ride and user types (shared with the Ionic app)
  utils/                fare math, geo, places, time helpers (shared with the Ionic app)
  theme/                tokens: light + dark palettes, type scale, spacing
docs/                   phase notes
```
