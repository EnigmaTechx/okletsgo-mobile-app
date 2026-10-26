import type { UserProfile } from "../interfaces/user";

// ============================================================================
// PROMOTIONS (config/promotions)
//
// The admin dashboard's Promotions page writes ONE public document and every
// running app reacts live, like config/features:
//
//   config/promotions
//     items: [
//       { id: "welcome-2026", kind: "welcome", audience: "clients",
//         active: true, badge: "Welcome gift",
//         title: "Your first ride is on us, {firstName}.",
//         body: "…", ctaLabel: "Book a ride", ctaRoute: "book",
//         couponCode: "WELCOME10KM", maxFreeKm: 10, newAccountDays: 30,
//         startsAt: null, endsAt: null },
//       { id: "…", kind: "coupon" | "info", … }
//     ]
//     kmRewards: { enabled: true, kmPerCredit: 200, creditKm: 10 }
//
// Kinds:
//   welcome  first ride free up to `maxFreeKm`, one per new account, paid by
//            a hidden "distance" coupon (`couponCode`) the server redeems
//            through the claimWelcomePromo function.
//   coupon   a public coupon worth announcing: the pop-up shows the code.
//   info     an announcement with an optional call to action.
//
// This module decides what the app SHOWS. What is DISCOUNTED is decided
// again server-side (claimWelcomePromo, redeemKmReward) from the same doc.
// The admin's src/lib/promotions.ts mirrors these types; keep them in sync.
// ============================================================================

export type PromoKind = "welcome" | "coupon" | "info";
export type PromoAudience = "clients" | "drivers" | "all";
/** Where a pop-up's button goes. Named, so config can't point anywhere. */
export type PromoCta = "book" | "rewards" | "trips" | "account" | "earnings";

export const PROMO_CTAS: readonly PromoCta[] = [
  "book",
  "rewards",
  "trips",
  "account",
  "earnings",
];

export interface PromotionItem {
  id: string;
  kind: PromoKind;
  audience: PromoAudience;
  active: boolean;
  badge: string | null;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaRoute: PromoCta | null;
  couponCode: string | null;
  maxFreeKm: number | null;
  newAccountDays: number | null;
  startsAt: string | null;
  endsAt: string | null;
}

export interface KmRewardsConfig {
  enabled: boolean;
  /** Completed-trip km that bank one credit. */
  kmPerCredit: number;
  /** Free km per credit. */
  creditKm: number;
}

export interface PromotionsConfig {
  items: PromotionItem[];
  kmRewards: KmRewardsConfig;
}

export const DEFAULT_KM_REWARDS: KmRewardsConfig = {
  enabled: false,
  kmPerCredit: 200,
  creditKm: 10,
};

export const EMPTY_PROMOTIONS: PromotionsConfig = {
  items: [],
  kmRewards: DEFAULT_KM_REWARDS,
};

/** The ride-document marker for a spent km credit (promoId). */
export const KM_REWARD_PROMO_ID = "km-reward";

const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v : null;
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Whatever is in Firestore, as a well-formed config (bad items dropped). */
export function normalisePromotions(raw: unknown): PromotionsConfig {
  const d = (raw ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(d.items) ? d.items : [])
    .map((entry): PromotionItem | null => {
      const r = (entry ?? {}) as Record<string, unknown>;
      const id = str(r.id);
      const kind = r.kind;
      const title = str(r.title);
      if (
        !id ||
        !title ||
        (kind !== "welcome" && kind !== "coupon" && kind !== "info")
      )
        return null;
      const audience = r.audience;
      const cta = r.ctaRoute;
      return {
        id,
        kind,
        audience:
          audience === "drivers" || audience === "all" ? audience : "clients",
        active: r.active === true,
        badge: str(r.badge),
        title,
        body: str(r.body) ?? "",
        ctaLabel: str(r.ctaLabel),
        ctaRoute: PROMO_CTAS.includes(cta as PromoCta)
          ? (cta as PromoCta)
          : null,
        couponCode: str(r.couponCode)?.toUpperCase() ?? null,
        maxFreeKm: num(r.maxFreeKm),
        newAccountDays: num(r.newAccountDays),
        startsAt: str(r.startsAt),
        endsAt: str(r.endsAt),
      };
    })
    .filter((i): i is PromotionItem => i !== null);
  const k = (d.kmRewards ?? {}) as Record<string, unknown>;
  const kmPerCredit = num(k.kmPerCredit);
  const creditKm = num(k.creditKm);
  return {
    items,
    kmRewards: {
      enabled: k.enabled === true,
      kmPerCredit:
        kmPerCredit && kmPerCredit > 0
          ? kmPerCredit
          : DEFAULT_KM_REWARDS.kmPerCredit,
      creditKm:
        creditKm && creditKm > 0 ? creditKm : DEFAULT_KM_REWARDS.creditKm,
    },
  };
}

/** Switched on and inside its start/end window, if it has one. */
export function isPromoLive(item: PromotionItem, now: number): boolean {
  if (!item.active) return false;
  const starts = item.startsAt ? Date.parse(item.startsAt) : NaN;
  const ends = item.endsAt ? Date.parse(item.endsAt) : NaN;
  if (Number.isFinite(starts) && now < starts) return false;
  if (Number.isFinite(ends) && now > ends) return false;
  return true;
}

export function promoAppliesTo(
  item: PromotionItem,
  role: UserProfile["role"] | null | undefined,
): boolean {
  if (role !== "client" && role !== "driver") return false;
  if (item.audience === "all") return true;
  return item.audience === (role === "client" ? "clients" : "drivers");
}

/**
 * The account-side half of welcome eligibility: a client whose account is
 * younger than the item's `newAccountDays`. Whether they have ridden yet is
 * answered by `hasCompletedRide` (a query), and the server checks both
 * again when the gift is claimed.
 */
export function accountQualifiesForWelcome(
  item: PromotionItem,
  profile: Pick<UserProfile, "role" | "createdAt"> | null | undefined,
  now: number,
): boolean {
  if (!profile || profile.role !== "client") return false;
  if (item.kind !== "welcome" || !item.couponCode) return false;
  const days = item.newAccountDays ?? 0;
  if (days <= 0) return true;
  const created = Date.parse(profile.createdAt);
  if (!Number.isFinite(created)) return false;
  return now - created <= days * 24 * 60 * 60 * 1000;
}

/** "{firstName}" in promo copy becomes the rider's name (or is dropped). */
export function personalise(text: string, firstName?: string | null): string {
  const name = firstName?.trim();
  return text
    .replace(/,\s*\{firstName\}/g, name ? `, ${name}` : "")
    .replace(/\{firstName\}/g, name ?? "");
}

/**
 * Discount for "the first N km free": the whole fare when the trip is no
 * longer than N km, otherwise what N km costs at the active pricing. The
 * server computes the same thing authoritatively.
 */
export function distanceDiscount(
  fare: number,
  distanceKm: number,
  freeKm: number,
  fareForKm: (km: number) => number,
): number {
  if (!(fare > 0) || !(freeKm > 0)) return 0;
  if (!Number.isFinite(distanceKm) || distanceKm <= freeKm) return fare;
  return Math.round(Math.min(fare, fareForKm(freeKm)) * 100) / 100;
}

export interface KmBank {
  /** Whole credits available to spend. */
  credits: number;
  /** Km of free riding those credits are worth. */
  freeKm: number;
  /** Progress towards the next credit, in km (0 ≤ progressKm < kmPerCredit). */
  progressKm: number;
  kmPerCredit: number;
  creditKm: number;
}

/** Andy's km program: every `kmPerCredit` km ridden banks one credit. */
export function kmBank(
  profile: Pick<UserProfile, "totalKmTravelled" | "rewardKmRedeemed"> | null,
  config: KmRewardsConfig,
): KmBank {
  const total = Math.max(0, Number(profile?.totalKmTravelled) || 0);
  const spent = Math.max(0, Number(profile?.rewardKmRedeemed) || 0);
  const earned = Math.floor(total / config.kmPerCredit);
  const credits = Math.max(0, earned - spent);
  return {
    credits,
    freeKm: credits * config.creditKm,
    progressKm: Math.round((total - earned * config.kmPerCredit) * 10) / 10,
    kmPerCredit: config.kmPerCredit,
    creditKm: config.creditKm,
  };
}
