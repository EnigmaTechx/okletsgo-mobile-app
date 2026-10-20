import {
  PhoneAuthProvider,
  updatePhoneNumber,
  verifyPhoneNumber,
  type User,
} from "@react-native-firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "@react-native-firebase/firestore";
import { auth, db } from "./firebase";

/**
 * Profile edits, account deletion and the Terms document: the pieces the
 * Ionic Settings and Profile pages wrote, on the same Firestore fields.
 */

export interface ProfileFields {
  firstName: string;
  lastName: string;
  email: string;
  /** E.164, e.g. "+15195550123". */
  phone: string;
}

/** Merge name, email and phone into users/{uid}. */
export async function updateProfileFields(
  uid: string,
  fields: ProfileFields,
): Promise<void> {
  await setDoc(doc(db, "users", uid), fields, { merge: true });
}

/**
 * Deactivate now, delete in 30 days: the same two fields the Ionic app
 * writes, which the OTP screen's "restore account" prompt reads back.
 */
export async function scheduleAccountDeletion(uid: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    status: "scheduled_for_deletion",
    deletionScheduledAt: serverTimestamp(),
  });
}

// ─── Phone number change ────────────────────────────────────────────────────
// Changing the sign-in number means re-verifying it by SMS. The native SDK
// reports progress through a listener; this wraps it so the screen sees a
// verificationId (code sent) or, on Android auto-retrieval, the code itself.

export interface PhoneChangeStart {
  verificationId: string;
  /** Present when Android read the SMS itself; the screen can skip the input. */
  autoCode: string | null;
}

export function startPhoneChange(phoneE164: string): Promise<PhoneChangeStart> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    verifyPhoneNumber(auth, phoneE164).on(
      "state_changed",
      (snapshot) => {
        if (snapshot.state === "sent") {
          settle(() =>
            resolve({
              verificationId: snapshot.verificationId,
              autoCode: null,
            }),
          );
        } else if (snapshot.state === "verified") {
          settle(() =>
            resolve({
              verificationId: snapshot.verificationId,
              autoCode: snapshot.code,
            }),
          );
        } else if (snapshot.state === "error") {
          settle(() => reject(snapshot.error ?? new Error("auth/unknown")));
        }
        // "timeout" only ends auto-retrieval; the code can still be typed.
      },
      (error) => settle(() => reject(error)),
    );
  });
}

/** Attach the verified number to the signed-in account. */
export async function confirmPhoneChange(
  user: User,
  verificationId: string,
  code: string,
): Promise<void> {
  const credential = PhoneAuthProvider.credential(verificationId, code);
  await updatePhoneNumber(user, credential);
}

// ─── Terms of Use ───────────────────────────────────────────────────────────

export interface RemoteTerms {
  markdown: string;
  effectiveDate?: string;
  version?: string;
}

/**
 * Admin-managed Terms from config/termsOfUse. Resolves null when the
 * document is missing, unreachable or too short to be real, so the screen
 * falls back to the built-in copy.
 */
export async function fetchTermsOfUse(): Promise<RemoteTerms | null> {
  try {
    const snap = await getDoc(doc(db, "config", "termsOfUse"));
    const data = snap.exists()
      ? (snap.data() as Record<string, unknown>)
      : null;
    if (
      data &&
      typeof data.markdown === "string" &&
      data.markdown.trim().length > 20
    ) {
      return {
        markdown: data.markdown,
        effectiveDate:
          typeof data.effectiveDate === "string"
            ? data.effectiveDate
            : undefined,
        version: typeof data.version === "string" ? data.version : undefined,
      };
    }
    return null;
  } catch (err) {
    console.warn("Terms of Use unavailable; using built-in copy", err);
    return null;
  }
}
