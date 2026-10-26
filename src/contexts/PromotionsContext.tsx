import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import {
  accountQualifiesForWelcome,
  EMPTY_PROMOTIONS,
  isPromoLive,
  kmBank,
  promoAppliesTo,
  type KmBank,
  type PromotionItem,
  type PromotionsConfig,
} from "../config/promotions";
import {
  hasCompletedRide,
  markPromoSeen,
  subscribePromotions,
} from "../services/promotionsService";
import { subscribeClientOpenRides } from "../services/rideService";

/**
 * Live view of `config/promotions` for the signed-in user: which pop-ups
 * they have not seen, whether the welcome gift is theirs to use, and how
 * many km credits they have banked. One listener for the whole app, like
 * the feature flags.
 */

interface PromotionsContextType {
  config: PromotionsConfig;
  /** First snapshot (or error) received. */
  loaded: boolean;
  /** The live welcome item this account qualifies for by age and role. */
  welcome: PromotionItem | null;
  /**
   * The gift is theirs to use right now: eligible, not yet ridden, and not
   * already riding on an open booking. False until that is known.
   */
  welcomeAvailable: boolean;
  /** The open ride the gift is already booked on, if any. */
  welcomeBookedRideId: string | null;
  /** Andy's km program, or null while it is switched off. */
  bank: KmBank | null;
  /** Pop-ups this account has not dismissed, in the admin's order. */
  popups: PromotionItem[];
  /** Remember a dismissal on the account (never shows again, any device). */
  markSeen: (promoId: string) => Promise<void>;
}

const PromotionsContext = createContext<PromotionsContextType>({
  config: EMPTY_PROMOTIONS,
  loaded: false,
  welcome: null,
  welcomeAvailable: false,
  welcomeBookedRideId: null,
  bank: null,
  popups: [],
  markSeen: async () => undefined,
});

export const usePromotions = () => useContext(PromotionsContext);

export const PromotionsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { currentUser, userProfile } = useAuth();
  const uid = currentUser?.uid;
  const [config, setConfig] = useState<PromotionsConfig>(EMPTY_PROMOTIONS);
  const [loaded, setLoaded] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(
    () =>
      subscribePromotions((c) => {
        setConfig(c);
        setLoaded(true);
      }),
    [],
  );

  const role = userProfile?.role;
  const welcome = useMemo(
    () =>
      config.items.find(
        (i) =>
          i.kind === "welcome" &&
          isPromoLive(i, now) &&
          promoAppliesTo(i, role) &&
          accountQualifiesForWelcome(i, userProfile, now),
      ) ?? null,
    [config.items, role, userProfile, now],
  );

  // Has the rider finished a trip yet? Asked once the gift is in play and
  // again after each completed trip (completeRide bumps totalKmTravelled).
  const ridden = userProfile?.totalKmTravelled ?? 0;
  const [used, setUsed] = useState<{ key: string; value: boolean } | null>(
    null,
  );
  const usedKey = welcome && uid ? `${uid}:${welcome.id}:${ridden}` : null;
  useEffect(() => {
    if (!usedKey || !uid) return;
    let active = true;
    hasCompletedRide(uid)
      .then((v) => active && setUsed({ key: usedKey, value: v }))
      .catch((err) => console.warn("Could not check ride history:", err));
    return () => {
      active = false;
    };
  }, [usedKey, uid]);
  const welcomeUsed = used?.key === usedKey ? used.value : null;

  // Is the gift already riding on an open booking? (One free ride, not one
  // per booking attempt.) Firestore shares this listener with Home's.
  const [bookedOn, setBookedOn] = useState<{
    uid: string;
    rideId: string | null;
  } | null>(null);
  const watchRides = !!uid && !!welcome && welcomeUsed === false;
  useEffect(() => {
    if (!watchRides || !uid || !welcome) return;
    return subscribeClientOpenRides(uid, (rides) => {
      const hit = rides.find((r) => r.promoId === welcome.id);
      setBookedOn({ uid, rideId: hit?.id ?? null });
    });
  }, [watchRides, uid, welcome]);
  const welcomeBookedRideId =
    watchRides && bookedOn?.uid === uid ? bookedOn.rideId : null;

  const welcomeAvailable =
    !!welcome && welcomeUsed === false && welcomeBookedRideId === null;

  const bank = useMemo(
    () =>
      config.kmRewards.enabled && role === "client"
        ? kmBank(userProfile, config.kmRewards)
        : null,
    [config.kmRewards, role, userProfile],
  );

  const seen = userProfile?.promoSeen;
  const popups = useMemo(
    () =>
      config.items.filter((i) => {
        if (!isPromoLive(i, now) || !promoAppliesTo(i, role)) return false;
        if (seen?.[i.id]) return false;
        if (i.kind === "welcome") return welcomeAvailable;
        return true;
      }),
    [config.items, role, seen, welcomeAvailable, now],
  );

  const markSeen = useCallback(
    async (promoId: string) => {
      if (!uid) return;
      try {
        await markPromoSeen(uid, seen, promoId);
      } catch (err) {
        console.warn("Could not record the promo dismissal:", err);
      }
    },
    [uid, seen],
  );

  const value = useMemo<PromotionsContextType>(
    () => ({
      config,
      loaded,
      welcome,
      welcomeAvailable,
      welcomeBookedRideId,
      bank,
      popups,
      markSeen,
    }),
    [
      config,
      loaded,
      welcome,
      welcomeAvailable,
      welcomeBookedRideId,
      bank,
      popups,
      markSeen,
    ],
  );

  return (
    <PromotionsContext.Provider value={value}>
      {children}
    </PromotionsContext.Provider>
  );
};
