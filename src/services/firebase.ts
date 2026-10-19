// Native Firebase instances for the whole app.
//
// Unlike the Ionic app, nothing is configured from `.env` here: React Native
// Firebase reads `google-services.json` (Android) and `GoogleService-Info.plist`
// (iOS) at build time, which EAS injects from file secrets (see docs/PHASE0.md).
// The project, collections and Cloud Functions are the same ones the live app
// uses, so a rider on either app sees the same data.
import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";
import { getFunctions } from "@react-native-firebase/functions";
import { getStorage } from "@react-native-firebase/storage";

export const app = getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
