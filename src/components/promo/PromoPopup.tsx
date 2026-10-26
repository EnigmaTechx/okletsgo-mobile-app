import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { usePromotions } from "../../contexts/PromotionsContext";
import type { PromoCta, PromotionItem } from "../../config/promotions";
import { promoPopupShownKey, sessionFlag } from "../../utils/sessionFlags";
import { PromoSheet } from "./PromoSheet";

interface Props {
  /** Nothing pops over a pending or active ride (the caller knows). */
  blocked: boolean;
}

const CLIENT_ROUTES: Record<PromoCta, string> = {
  book: "/(ride)/book/locations",
  rewards: "/(client)/rewards",
  trips: "/(client)/trips",
  account: "/(client)/account",
  earnings: "/(client)/rewards",
};
const DRIVER_ROUTES: Record<PromoCta, string> = {
  book: "/(driver)",
  rewards: "/(driver)",
  trips: "/(driver)/trips",
  account: "/(driver)/account",
  earnings: "/(driver)/earnings",
};

/**
 * Mounted on each role's Home: when Home is in front, nothing is live and
 * a pop-up is waiting, shows it, once per launch. A dismissal is written
 * to the account, so it never returns on any device.
 */
export function PromoPopup({ blocked }: Props) {
  const router = useRouter();
  const { userProfile } = useAuth();
  const { popups, loaded, markSeen } = usePromotions();
  const [showing, setShowing] = useState<PromotionItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (blocked || !loaded || showing) return;
      const next = popups[0];
      if (!next || sessionFlag.has(promoPopupShownKey())) return;
      // Deferred so the tab's own transition finishes first.
      const t = setTimeout(() => {
        sessionFlag.set(promoPopupShownKey());
        setShowing(next);
      }, 450);
      return () => clearTimeout(t);
    }, [blocked, loaded, popups, showing]),
  );

  const close = (item: PromotionItem) => {
    setShowing(null);
    void markSeen(item.id);
  };

  const routes = userProfile?.role === "driver" ? DRIVER_ROUTES : CLIENT_ROUTES;

  return (
    <PromoSheet
      item={showing}
      firstName={userProfile?.firstName}
      onDismiss={close}
      onCta={(item) => {
        close(item);
        if (item.ctaRoute) router.push(routes[item.ctaRoute] as never);
      }}
    />
  );
}
