import {
  collection,
  query,
  where,
  onSnapshot,
  type Timestamp,
} from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";
import { db, functions } from "./firebase";

// Coupon model — mirrors what the admin dashboard writes to coupons/{CODE}.
// Redemption + the authoritative discount happen server-side (Cloud Function).
// Anything here is display / preview only.

export type DiscountType = "percent" | "fixed";
export type CouponAudience = "all" | "targeted";

export interface Coupon {
  id: string;
  code: string;
  description?: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minFare?: number | null;
  validFrom?: Timestamp | null;
  validUntil?: Timestamp | null;
  maxRedemptions?: number | null;
  maxPerUser?: number | null;
  audience: CouponAudience;
  eligibleUserIds?: string[];
  active: boolean;
  redeemedCount?: number;
  /** Promotion coupons (e.g. the welcome gift) are applied automatically and
   *  never listed under "Your codes". */
  hidden?: boolean;
}

/**
 * Preview the discount a coupon yields on a fare. Mirrors the authoritative
 * server-side calculation. Platform absorbs the discount, so this only
 * affects what the client pays.
 */
export function computeDiscount(c: Coupon, fare: number): number {
  if (!(fare > 0)) return 0;
  if (c.minFare && fare < c.minFare) return 0;
  let d =
    c.discountType === "percent"
      ? (c.discountValue / 100) * fare
      : c.discountValue;
  if (c.maxDiscount && c.maxDiscount > 0) d = Math.min(d, c.maxDiscount);
  d = Math.min(d, fare);
  return Math.round(d * 100) / 100;
}

/** Short label, e.g. "50% OFF up to $10" or "$12 OFF". */
export function discountLabel(c: Coupon): string {
  if (c.discountType === "percent")
    return `${c.discountValue}% OFF${c.maxDiscount ? ` up to $${c.maxDiscount}` : ""}`;
  return `$${c.discountValue} OFF`;
}

export function isCurrentlyRedeemable(c: Coupon, now: number): boolean {
  const from = c.validFrom?.toMillis?.();
  const until = c.validUntil?.toMillis?.();
  if (from && now < from) return false;
  if (until && now > until) return false;
  if (c.maxRedemptions && (c.redeemedCount ?? 0) >= c.maxRedemptions) return false;
  return true;
}

/**
 * Live listener for the coupons a client can currently use. Merges two queries
 * — public active coupons, and active coupons targeting this uid — de-dupes by
 * code, drops out-of-window / exhausted / hidden ones, and pushes updates in
 * real time (so a coupon published in admin appears while the page is open).
 * Returns an unsubscribe function.
 */
export function subscribeAvailableCoupons(
  uid: string,
  onChange: (coupons: Coupon[]) => void,
): () => void {
  const col = collection(db, "coupons");
  const qPublic = query(
    col,
    where("active", "==", true),
    where("audience", "==", "all"),
  );
  const qTargeted = query(
    col,
    where("active", "==", true),
    where("eligibleUserIds", "array-contains", uid),
  );

  let publicList: Coupon[] = [];
  let targetedList: Coupon[] = [];
  let readyPublic = false;
  let readyTargeted = false;

  const emit = () => {
    if (!readyPublic || !readyTargeted) return; // wait for both first loads
    const byId = new Map<string, Coupon>();
    [...publicList, ...targetedList].forEach((c) => byId.set(c.id, c));
    const now = Date.now();
    const list = [...byId.values()]
      .filter((c) => !c.hidden && isCurrentlyRedeemable(c, now))
      .sort((a, b) => a.code.localeCompare(b.code));
    onChange(list);
  };

  const unsubPublic = onSnapshot(
    qPublic,
    (snap) => {
      publicList = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
      readyPublic = true;
      emit();
    },
    (e) => {
      console.warn("Coupons (public) listener failed:", e);
      readyPublic = true;
      emit();
    },
  );
  const unsubTargeted = onSnapshot(
    qTargeted,
    (snap) => {
      targetedList = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
      readyTargeted = true;
      emit();
    },
    (e) => {
      console.warn("Coupons (targeted) listener failed:", e);
      readyTargeted = true;
      emit();
    },
  );

  return () => {
    unsubPublic();
    unsubTargeted();
  };
}

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
  description?: string | null;
}

/**
 * Server-side coupon preview (no state change) for a given fare. Throws a
 * FirebaseError whose `message` is a user-friendly reason when invalid.
 */
export async function validateCouponRemote(
  code: string,
  fare: number,
): Promise<AppliedCoupon> {
  const fn = httpsCallable<
    { code: string; fare: number },
    { code: string; discountAmount: number; description?: string | null }
  >(functions, "validateCoupon");
  const res = await fn({ code: code.trim().toUpperCase(), fare });
  const d = res.data;
  return { code: d.code, discountAmount: d.discountAmount, description: d.description ?? null };
}

/**
 * Atomically redeem a coupon at booking. Enforces usage limits server-side and
 * records the redemption against the ride. Returns the authoritative discount.
 */
export async function redeemCouponRemote(
  code: string,
  rideId: string,
  fare: number,
): Promise<number> {
  const fn = httpsCallable<
    { code: string; rideId: string; fare: number },
    { discountAmount: number }
  >(functions, "redeemCoupon");
  const res = await fn({ code: code.trim().toUpperCase(), rideId, fare });
  return res.data.discountAmount;
}
