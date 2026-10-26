import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";
import { db, functions } from "./firebase";
import {
  EMPTY_PROMOTIONS,
  normalisePromotions,
  type PromotionsConfig,
} from "../config/promotions";

/**
 * The promotions document and the two server calls that turn a promotion
 * into a discount. Everything shown in the app comes from the live
 * document; everything charged is decided again by the functions.
 */

/** Live `config/promotions`. A missing document or an error means nothing is on. */
export function subscribePromotions(
  onChange: (config: PromotionsConfig) => void,
): () => void {
  return onSnapshot(
    doc(db, "config", "promotions"),
    (snap) => {
      onChange(
        snap.exists() ? normalisePromotions(snap.data()) : EMPTY_PROMOTIONS,
      );
    },
    (err) => {
      console.warn("[promotions] config/promotions unavailable", err);
      onChange(EMPTY_PROMOTIONS);
    },
  );
}

/**
 * Remember on the account that a pop-up was dismissed (or its gift used),
 * so a reinstall or a second phone never shows it again. The whole map is
 * written: promo ids contain hyphens, which dotted field paths reject.
 */
export async function markPromoSeen(
  uid: string,
  current: Record<string, string> | undefined,
  promoId: string,
): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    promoSeen: { ...(current ?? {}), [promoId]: new Date().toISOString() },
  });
}

/** Has this rider ever finished a trip? (The welcome gift is for the first.) */
export async function hasCompletedRide(uid: string): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, "rides"),
      where("clientId", "==", uid),
      where("status", "==", "completed"),
      limit(1),
    ),
  );
  return !snap.empty;
}

export interface WelcomeClaim {
  discountAmount: number;
  promoId: string;
  couponCode: string;
}

/** Redeem the welcome gift on a just-booked ride. Throws with a reason. */
export async function claimWelcomePromoRemote(
  rideId: string,
  promoId: string,
): Promise<WelcomeClaim> {
  const fn = httpsCallable<{ rideId: string; promoId: string }, WelcomeClaim>(
    functions,
    "claimWelcomePromo",
  );
  return (await fn({ rideId, promoId })).data;
}

export interface KmRewardClaim {
  discountAmount: number;
  creditsLeft: number;
}

/** Spend one banked km credit on a just-booked ride. Throws with a reason. */
export async function redeemKmRewardRemote(
  rideId: string,
): Promise<KmRewardClaim> {
  const fn = httpsCallable<{ rideId: string }, KmRewardClaim>(
    functions,
    "redeemKmReward",
  );
  return (await fn({ rideId })).data;
}
