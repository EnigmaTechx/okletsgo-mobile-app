/**
 * One place that turns a Firebase (or any) error from the sign-in /
 * registration flow into words a rider can act on. Nothing that reaches a
 * user from these screens should ever read "Firebase: Error (auth/…)".
 *
 * `code` is still returned raw so it can be logged to Auth Diagnostics and
 * pre-filled into the support email.
 */

export interface FriendlyAuthError {
  /** Raw Firebase code (e.g. "auth/code-expired") or a trimmed message. */
  code: string;
  title: string;
  message: string;
  /** The remedy is a fresh code — offer a Resend action. */
  resend?: boolean;
  /** Worth offering "Email support" (lockouts, config problems, unknowns). */
  support?: boolean;
  /** Only an exact typo — keep the entered digits' screen, no navigation. */
  retry?: boolean;
  /** No specific copy matched; the raw code is worth surfacing to support. */
  unknown?: boolean;
}

export const extractErrorCode = (err: unknown): string => {
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    if (typeof o.code === "string" && o.code) return o.code;
    if (typeof o.message === "string") {
      // Native plugin errors often carry only a message like
      // "… [auth/invalid-verification-code] …" or "Firebase: Error (auth/x)."
      const m = o.message.match(/auth\/[a-z-]+/);
      if (m) return m[0];
      return o.message.slice(0, 160);
    }
  }
  if (typeof err === "string") return err.slice(0, 160);
  return "unknown";
};

const GENERIC: Omit<FriendlyAuthError, "code"> = {
  title: "Something went wrong",
  message:
    "We couldn't complete that step. Please try again in a moment — and if it keeps happening, email us so we can help.",
  support: true,
  unknown: true,
};

/** Errors from sending the code (Login) and resending it (OTP). */
export const describeSendCodeError = (err: unknown): FriendlyAuthError => {
  const code = extractErrorCode(err);
  switch (code) {
    case "auth/too-many-requests":
      return {
        code,
        title: "Too many attempts",
        message:
          "Sign-in from this phone has been temporarily blocked after several attempts. Please wait about an hour, then try once — each extra attempt extends the block. If it keeps happening, email us and we'll sort it out.",
        support: true,
      };
    case "auth/invalid-phone-number":
    case "auth/missing-phone-number":
      return {
        code,
        title: "Invalid number",
        message:
          "That phone number doesn't look right. Please check it and try again.",
        retry: true,
      };
    case "auth/quota-exceeded":
      return {
        code,
        title: "Try again later",
        message:
          "We can't send verification texts right now. Please try again in a little while, or email us if you're in a hurry.",
        support: true,
      };
    case "auth/network-request-failed":
      return {
        code,
        title: "No connection",
        message:
          "We couldn't reach the server. Check your internet connection and try again.",
        retry: true,
      };
    case "auth/captcha-check-failed":
    case "auth/missing-client-identifier":
    case "auth/app-not-authorized":
    case "auth/invalid-app-credential":
      return {
        code,
        title: "Couldn't verify this device",
        message:
          "We couldn't confirm this phone with our verification service. Please make sure the app is up to date from the Play Store or App Store and try again. If it still fails, email us.",
        support: true,
      };
    case "auth/user-disabled":
      return {
        code,
        title: "Account unavailable",
        message:
          "This account has been disabled. Please email us if you think this is a mistake.",
        support: true,
      };
    default:
      return { code, ...GENERIC };
  }
};

/** Errors from confirming the 6-digit code (OTP). */
export const describeVerifyCodeError = (err: unknown): FriendlyAuthError => {
  const code = extractErrorCode(err);
  switch (code) {
    case "auth/invalid-verification-code":
      return {
        code,
        title: "Incorrect code",
        message:
          "That code doesn't match. Please check the text message and try again — or request a new code.",
        retry: true,
      };
    case "auth/code-expired":
    case "auth/session-expired":
    case "auth/invalid-verification-id":
    case "auth/missing-verification-id":
      return {
        code,
        title: "Code expired",
        message:
          "That code is no longer valid — codes only work for a few minutes. Tap Resend to get a fresh one and enter it straight away.",
        resend: true,
      };
    case "auth/too-many-requests":
      return {
        code,
        title: "Too many attempts",
        message:
          "Too many codes have been tried from this phone. Please wait about an hour before requesting a new one. If it keeps happening, email us.",
        support: true,
      };
    case "auth/network-request-failed":
      return {
        code,
        title: "No connection",
        message:
          "We couldn't reach the server. Check your internet connection and tap Verify again.",
        retry: true,
      };
    case "auth/user-disabled":
      return {
        code,
        title: "Account unavailable",
        message:
          "This account has been disabled. Please email us if you think this is a mistake.",
        support: true,
      };
    // The rest only arise when changing the number on an existing account.
    case "auth/credential-already-in-use":
    case "auth/account-exists-with-different-credential":
    case "auth/phone-number-already-exists":
      return {
        code,
        title: "Number already in use",
        message:
          "That mobile number is already linked to another OK Let's Go account. Use a different number, or email us if you think this is a mistake.",
        support: true,
      };
    case "auth/requires-recent-login":
      return {
        code,
        title: "Please confirm it's you",
        message:
          "For your security, we need to verify your current number before changing it. Please try again and follow the prompt.",
        retry: true,
      };
    default:
      return { code, ...GENERIC };
  }
};

/** Errors while saving the profile (Firestore / Storage) during registration. */
export const describeProfileSaveError = (err: unknown): FriendlyAuthError => {
  const code = extractErrorCode(err);
  if (code === "permission-denied" || code.includes("permission-denied")) {
    return {
      code,
      title: "Couldn't save your profile",
      message:
        "Your details couldn't be saved. Please make sure the app is up to date and try again — if it keeps happening, email us.",
      support: true,
    };
  }
  if (
    code === "unavailable" ||
    code.includes("network") ||
    code.includes("unavailable")
  ) {
    return {
      code,
      title: "No connection",
      message:
        "We couldn't reach the server. Check your internet connection and try again.",
      retry: true,
    };
  }
  return {
    code,
    title: "Couldn't save your profile",
    message:
      "Something went wrong while saving your details. Please try again — if it keeps happening, email us.",
    support: true,
  };
};
