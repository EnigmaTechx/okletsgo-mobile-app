import {
  appVersionLabel,
  deviceDescription,
} from "../services/telemetryService";

export const SUPPORT_EMAIL = "support.okletsgo@gmail.com";
export const PRIVACY_POLICY_URL =
  "https://sites.google.com/view/ok-lets-go-privacy-policy/home";

/** "+1416*******57" — enough to recognise a number in diagnostics, no more. */
export const maskPhone = (phone: string): string =>
  phone ? phone.slice(0, 4) + "*******" + phone.slice(-2) : "";

/**
 * mailto: link to support, pre-filled so the reply has what we need. Reachable
 * before sign-in, so a locked-out user has a way to reach us without an account.
 */
export const supportMailto = (opts: {
  subject: string;
  intro: string;
  phone?: string;
  errorCode?: string;
}): string => {
  const lines = [
    opts.intro,
    "",
    `Phone: ${opts.phone ? maskPhone(opts.phone) : "(not entered)"}`,
    `Device: ${deviceDescription()}`,
    `App: ${appVersionLabel() || "unknown version"}`,
    `Error: ${opts.errorCode || "none shown"}`,
    "",
    "What happened:",
    "",
  ];
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(opts.subject)}&body=${encodeURIComponent(
    lines.join("\n"),
  )}`;
};
