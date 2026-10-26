import { KM_REWARD_PROMO_ID } from "../config/promotions";

/**
 * The one line a ride's discount is described by, wherever a ride is shown
 * (status panel, trip-complete panel, history, the driver's request):
 * "First ride free", "10 km credit" or "CODE applied".
 */
export function discountLabel(
  ride: {
    couponCode?: string | null;
    promoId?: string | null;
    kmRewardApplied?: boolean;
  },
  creditKm = 10,
): string {
  if (ride.kmRewardApplied || ride.promoId === KM_REWARD_PROMO_ID)
    return `${creditKm} km credit applied`;
  if (ride.promoId) return "First ride free";
  if (ride.couponCode) return `${ride.couponCode} applied`;
  return "Discount applied";
}
