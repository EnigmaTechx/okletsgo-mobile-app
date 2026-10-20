import type { UserProfile, UserRole } from "../interfaces/user";

// ============================================================================
// BUILD-TIME FLAGS
// These change what the app DOES (money moves), not just what it shows, so
// they are deliberately compile-time constants and cannot be flipped from the
// admin dashboard.
// ============================================================================
export const FEATURES = {
  // When true, runs the full Stripe card-vault flow on booking and applies
  // card-based cancellation fees. When false, rides are booked directly with
  // paymentStatus "paid_direct" (cash / e-transfer to the driver).
  STRIPE_PAYMENTS: false,
} as const;

// ============================================================================
// REMOTE FEATURE FLAGS (visibility only)
//
// Pages and widgets that exist in the app but are hidden until the product
// owner decides who should see them. Controlled live from the admin
// dashboard's "App Features" page, which writes the public Firestore document
// `config/features`:
//
//   config/features
//     payment:         { audience: "none" }
//     driver_earnings: { audience: "selected", userIds: ["<uid>", …] }
//     …
//
// `audience` is one of:
//   "none"      hidden from everyone (the default when the key is missing)
//   "all"       every signed-in user whose role the feature supports
//   "clients"   clients only
//   "drivers"   drivers only
//   "selected"  only the users listed in `userIds` (clients or drivers)
//
// Missing document, missing key, or a read error all mean HIDDEN — the app
// fails closed to exactly what it showed before this system existed.
// Evaluation lives in `isFeatureVisible`; components read it through
// `useFeatureFlags()` (src/contexts/FeatureFlagsContext.tsx).
// ============================================================================

export type FeatureKey =
  "payment" | "driver_earnings" | "driver_payouts" | "book_for_others";

export type FeatureAudience =
  "none" | "all" | "clients" | "drivers" | "selected";

export const FEATURE_AUDIENCES: readonly FeatureAudience[] = [
  "none",
  "all",
  "clients",
  "drivers",
  "selected",
];

export interface FeatureFlagState {
  audience?: FeatureAudience;
  /** Only read when audience is "selected". */
  userIds?: string[];
}

/** Shape of the `config/features` document. Unknown keys are ignored. */
export type FeatureFlagsDoc = Partial<Record<FeatureKey, FeatureFlagState>>;

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  /** Where it shows up in the app, for the admin overview. */
  surface: string;
  /** Roles that can ever see it. A "clients" audience on a drivers-only
   *  feature shows it to nobody. */
  roles: readonly UserRole[];
}

/**
 * The catalogue. Mirrored in the admin dashboard (src/lib/featureFlags.ts)
 * so the overview page can list every flag with the same wording — keep the
 * two in sync when adding one.
 */
export const FEATURE_CATALOGUE: readonly FeatureDefinition[] = [
  {
    key: "payment",
    label: "Payment",
    description:
      'The Payment page. Until card payments go live it shows a "Card Payments Coming Soon" notice.',
    surface: "Side menu → Payment",
    roles: ["client", "driver"],
  },
  {
    key: "driver_earnings",
    label: "Driver earnings",
    description:
      "The driver's Earnings page (balance, trips, km, recent activity), the Total Earnings tile on the driver dashboard, and the earnings badge in the side menu.",
    surface: "Side menu → Earnings · Driver dashboard tile",
    roles: ["driver"],
  },
  {
    key: "driver_payouts",
    label: "Driver payouts (prototype)",
    description:
      "The Earnings & Payouts page with Cash Out and Link Bank Account. Not wired to a payout provider yet — the buttons are placeholders.",
    surface: "Side menu → Payouts",
    roles: ["driver"],
  },
  {
    key: "book_for_others",
    label: "Book for someone else",
    description:
      "Passenger Name and Phone fields on the booking confirmation step, so a rider can book a trip for another person.",
    surface: "Book a ride → Confirmation step",
    roles: ["client"],
  },
];

export const FEATURE_KEYS: readonly FeatureKey[] = FEATURE_CATALOGUE.map(
  (f) => f.key,
);

const definitionFor = (key: FeatureKey): FeatureDefinition | undefined =>
  FEATURE_CATALOGUE.find((f) => f.key === key);

/**
 * Pure visibility check. `profile` is the signed-in user's profile (null while
 * loading or signed out → hidden). Exported separately from the hook so it
 * can be unit-tested and reused by the route guard.
 */
export function isFeatureVisible(
  flags: FeatureFlagsDoc | null | undefined,
  key: FeatureKey,
  profile: Pick<UserProfile, "uid" | "role"> | null | undefined,
): boolean {
  if (!profile) return false;
  const def = definitionFor(key);
  if (!def || !def.roles.includes(profile.role)) return false;

  const state = flags?.[key];
  switch (state?.audience) {
    case "all":
      return true;
    case "clients":
      return profile.role === "client";
    case "drivers":
      return profile.role === "driver";
    case "selected":
      return (
        Array.isArray(state.userIds) && state.userIds.includes(profile.uid)
      );
    default:
      // "none", missing, or an unrecognised value → hidden.
      return false;
  }
}
