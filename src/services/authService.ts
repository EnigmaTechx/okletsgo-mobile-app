import * as SecureStore from "expo-secure-store";
import {
  PhoneAuthProvider,
  signInWithCredential,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
  type UserCredential,
} from "@react-native-firebase/auth";
import { doc, getDoc, setDoc } from "@react-native-firebase/firestore";
import { auth, db } from "./firebase";
import { logAuthEvent } from "./telemetryService";
import type { UserProfile, UserRole, VehicleInfo } from "../interfaces/user";

/**
 * Phone sign-in, the same flow riders know from the Ionic app, on the native
 * Firebase SDK: no reCAPTCHA, Play Integrity / silent APNs do the device
 * check. The pieces that were earned in production are kept:
 *   - the verification session survives the app being killed while the user
 *     reads their SMS (persisted in SecureStore, 10-minute window);
 *   - a "registration in progress" flag so a verified user with no profile
 *     yet is never treated as a ghost session;
 *   - every step logs a funnel event to `authEvents` for Auth Diagnostics.
 */

// ─── In-memory confirmation result ──────────────────────────────────────────

/** Minimal shape both the native result and a rebuilt one satisfy. */
export interface PhoneConfirmation {
  verificationId: string;
  confirm: (smsCode: string) => Promise<UserCredential>;
}

let currentConfirmation: PhoneConfirmation | null = null;

export const getConfirmationResult = (): PhoneConfirmation | null =>
  currentConfirmation;
export const setConfirmationResult = (c: PhoneConfirmation | null) => {
  currentConfirmation = c;
};

// ─── Persisted OTP session ──────────────────────────────────────────────────
// SecureStore keys may only contain letters, digits, ".", "-" and "_".

const OTP_SESSION_KEY = "okletsgo.otpSession";
const OTP_SESSION_MAX_AGE_MS = 10 * 60 * 1000; // 10 min

export interface OtpSession {
  phone: string;
  verificationId: string;
}

export const persistOtpSession = (phone: string, verificationId: string) => {
  try {
    SecureStore.setItem(
      OTP_SESSION_KEY,
      JSON.stringify({ phone, verificationId, ts: Date.now() }),
    );
  } catch {
    /* storage unavailable — fall back to in-memory only */
  }
};

export const getOtpSession = (): OtpSession | null => {
  try {
    const raw = SecureStore.getItem(OTP_SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as {
      phone?: string;
      verificationId?: string;
      ts?: number;
    };
    if (
      !s?.verificationId ||
      Date.now() - (s.ts || 0) > OTP_SESSION_MAX_AGE_MS
    ) {
      return null;
    }
    return { phone: s.phone || "", verificationId: s.verificationId };
  } catch {
    return null;
  }
};

export const clearOtpSession = () => {
  void SecureStore.deleteItemAsync(OTP_SESSION_KEY).catch(() => undefined);
};

// ─── Registration-in-progress flag ──────────────────────────────────────────
// A newly-verified user is signed in at the Firebase level BEFORE their
// Firestore profile exists. During that window the app must not treat them as
// a stale/ghost session. The flag survives the app being killed (SecureStore),
// and expires so an abandoned registration never lingers forever.

const REG_ACTIVE_KEY = "okletsgo.registrationActive";
const REG_ACTIVE_MAX_AGE_MS = 30 * 60 * 1000; // 30 min to finish registration

export const setRegistrationActive = () => {
  try {
    SecureStore.setItem(REG_ACTIVE_KEY, JSON.stringify({ ts: Date.now() }));
  } catch {
    /* storage unavailable */
  }
};

export const isRegistrationActive = (): boolean => {
  try {
    const raw = SecureStore.getItem(REG_ACTIVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw) as { ts?: number };
    if (!s?.ts || Date.now() - s.ts > REG_ACTIVE_MAX_AGE_MS) {
      void SecureStore.deleteItemAsync(REG_ACTIVE_KEY).catch(() => undefined);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const clearRegistrationActive = () => {
  void SecureStore.deleteItemAsync(REG_ACTIVE_KEY).catch(() => undefined);
};

// ─── Sending and confirming the code ────────────────────────────────────────

const wrapNative = (
  phone: string,
  result: ConfirmationResult,
): PhoneConfirmation => {
  const verificationId = result.verificationId;
  const wrapped: PhoneConfirmation = {
    verificationId,
    confirm: async (smsCode: string) => {
      // Go through the credential path rather than result.confirm(): it works
      // identically for a fresh result and for a session rebuilt after the app
      // was killed, so there is exactly one code path to reason about.
      const credential = PhoneAuthProvider.credential(verificationId, smsCode);
      return signInWithCredential(auth, credential);
    },
  };
  setConfirmationResult(wrapped);
  persistOtpSession(phone, verificationId);
  return wrapped;
};

/** Rebuild an in-memory confirmation from a persisted verificationId. */
export const rebuildConfirmationResult = (
  verificationId: string,
): PhoneConfirmation => {
  const rebuilt: PhoneConfirmation = {
    verificationId,
    confirm: async (smsCode: string) => {
      const credential = PhoneAuthProvider.credential(verificationId, smsCode);
      return signInWithCredential(auth, credential);
    },
  };
  setConfirmationResult(rebuilt);
  return rebuilt;
};

/**
 * Send (or resend) the SMS code to a full E.164 number ("+15195550123").
 * Resolves once the code is on its way; rejects with a Firebase auth error
 * that `describeSendCodeError` turns into plain words.
 */
export const sendOtp = async (
  phoneNumber: string,
): Promise<PhoneConfirmation> => {
  const result = await signInWithPhoneNumber(auth, phoneNumber);
  return wrapNative(phoneNumber, result);
};

// ─── Profiles ───────────────────────────────────────────────────────────────

interface CreateProfileData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  vehicle?: VehicleInfo;
  photoUrl?: string;
}

export const checkUserProfile = async (
  uid: string,
): Promise<UserProfile | null> => {
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    return userDoc.data() as UserProfile;
  }
  return null;
};

export const createProfile = async (uid: string, data: CreateProfileData) => {
  // 1. Build the base object with strictly required/valid fields
  const userProfile: UserProfile = {
    uid,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    role: data.role,
    debt: 0,
    createdAt: new Date().toISOString(),
  };

  // 2. Conditionally attach the extra fields ONLY if they are valid
  if (data.role === "driver") {
    userProfile.isOnline = false;
  }
  if (data.vehicle) {
    userProfile.vehicle = data.vehicle;
  }
  if (data.photoUrl) {
    userProfile.photoUrl = data.photoUrl;
  }

  // 3. Save the clean object to Firestore. Log the outcome either way: a
  // verified user who never gets a profile is exactly the case that is
  // invisible in Auth Diagnostics otherwise.
  try {
    await setDoc(doc(db, "users", uid), userProfile);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as Record<string, unknown>).code)
        : err instanceof Error
          ? err.message.slice(0, 160)
          : "unknown";
    void logAuthEvent("profile_create_failed", { code, role: data.role });
    throw err;
  }
  void logAuthEvent("profile_created", { role: data.role });
  return userProfile;
};

export const logout = () => signOut(auth);
