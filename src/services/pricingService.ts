import { doc, onSnapshot } from "@react-native-firebase/firestore";
import { db } from "./firebase";
import {
  DEFAULT_PRICING,
  setActivePricing,
  isPricingReady,
  type PricingConfig,
} from "../utils/fareCalculator";

// Coerce a raw Firestore document into a complete PricingConfig, falling back
// to defaults for any missing/invalid field so a partial doc can never break
// fare calculation.
export function coercePricing(
  data: Record<string, unknown> | undefined,
): PricingConfig {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    minKm: num(data?.minKm, DEFAULT_PRICING.minKm),
    maxKm: num(data?.maxKm, DEFAULT_PRICING.maxKm),
    baseRate: num(data?.baseRate, DEFAULT_PRICING.baseRate),
    maxRate: num(data?.maxRate, DEFAULT_PRICING.maxRate),
    minFare: num(data?.minFare, DEFAULT_PRICING.minFare),
    serviceFee: num(data?.serviceFee, DEFAULT_PRICING.serviceFee),
    midTripCancellationFee: num(
      data?.midTripCancellationFee,
      DEFAULT_PRICING.midTripCancellationFee,
    ),
    cancellationFeePercent: num(
      data?.cancellationFeePercent,
      DEFAULT_PRICING.cancellationFeePercent,
    ),
    driverSharePercent: num(
      data?.driverSharePercent,
      DEFAULT_PRICING.driverSharePercent,
    ),
    currency:
      typeof data?.currency === "string" && data.currency.trim()
        ? (data.currency as string)
        : DEFAULT_PRICING.currency,
  };
}

let stop: (() => void) | null = null;

/**
 * Subscribe to the admin-managed `config/pricing` document and keep the active
 * fare config in sync. Safe to call once at app startup; idempotent. If the
 * document is missing or unreachable, the app keeps using DEFAULT_PRICING.
 * Returns an unsubscribe function.
 */
export function initPricingConfig(): () => void {
  if (stop) return stop;

  // Safety net: if the first read hasn't landed shortly (odd network, or a dev
  // build where Firestore can stall), unblock the fare UI with defaults so it
  // never hangs. A later real snapshot still updates the config.
  const timeout = setTimeout(() => {
    if (!isPricingReady()) setActivePricing(DEFAULT_PRICING);
  }, 8000);

  const unsubscribe = onSnapshot(
    doc(db, "config", "pricing"),
    (snapshot) => {
      clearTimeout(timeout);
      if (snapshot.exists()) {
        setActivePricing(
          coercePricing(snapshot.data() as Record<string, unknown>),
        );
      } else {
        setActivePricing(DEFAULT_PRICING);
      }
    },
    (error) => {
      clearTimeout(timeout);
      console.warn("Pricing config listener failed; using defaults.", error);
      setActivePricing(DEFAULT_PRICING);
    },
  );

  stop = () => {
    clearTimeout(timeout);
    unsubscribe();
    stop = null;
  };
  return stop;
}
