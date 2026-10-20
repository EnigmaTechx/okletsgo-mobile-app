This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## OK Let's Go — project notes

This repo is the React Native rebuild of the live Ionic app in
`rideshare-ionic-app`. Read that repo's `CLAUDE.md` for the product, the
Firestore schema, the Cloud Functions and the fare math: all of it is shared and
none of it changes here. The migration roadmap and parity tracker are in the
shared roadmap doc; per-phase notes are in `docs/`.

- **Backend is fixed.** Same Firebase project, same collections, same callable
  names. Never add a Cloud Function or rules change here without a matching
  change in the Ionic repo's `functions/` until the Ionic app is retired.
- **Native Firebase, modular API.** Import from `@react-native-firebase/*`
  (`collection`, `onSnapshot`, `httpsCallable` ...), never the `firebase/*` JS
  SDK. Instances live in `src/services/firebase.ts`.
- **No Expo Go.** Development builds only (`eas build --profile development`).
- **Config-doc pattern.** Admin-managed behaviour comes from Firestore
  `config/*` documents with a live listener and a sane default: pricing,
  features, terms, app (update gate), and promotions from phase 4.
- **Theme.** Colours come from `useTheme().colors`, never a hex in a component.
  Both palettes are in `src/theme/tokens.ts`; text goes through `AppText`.
- **Forms and the keyboard.** Any screen with inputs uses `<Screen scroll>`,
  which is a `KeyboardAwareScrollView` from react-native-keyboard-controller
  (`KeyboardProvider` sits in the root layout). Never reach for React
  Native's `KeyboardAvoidingView`: with Android edge-to-edge it leaves the
  fields under the keyboard unreachable. Chain fields with `returnKeyType`
  + `onSubmitEditing`.
- **Lint rules that bite.** The React Compiler is on: no components declared
  inside render, no `ref.current` reads during render (use `useState(() => …)`
  for one-time setup), and escape apostrophes in JSX text (`&apos;`).
- **Before committing:** `npx expo lint --max-warnings=0`, `npx tsc --noEmit`,
  `npx jest`. Native behaviour (phone auth, push, location) can only be checked
  on a device.
- **Identity.** `com.enigmatech.rideshare` on both platforms. `version`,
  `android.versionCode` and `ios.buildNumber` live in `app.json` and continue
  from the Ionic app (last Ionic build: 33); bump both build numbers together
  for every store submission.
