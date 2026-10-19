// Trip fare calculation.
//
// The pricing constants are managed from the admin web app (okletsgo-superadmin)
// and stored in the Firestore `config/pricing` document. At app startup
// `initPricingConfig()` (see services/pricingService.ts) loads that document and
// calls `setActivePricing()`, so fares can change without shipping a new build.
// Until the config loads (or if it's unreachable) the DEFAULT_PRICING values
// below are used — these mirror the previous hard-coded constants.
//
// Sliding per-km rate:
//   ≤ minKm      → baseRate/km (a minFare floor applies)
//   minKm–maxKm  → rate climbs linearly from baseRate to maxRate
//   ≥ maxKm      → capped at maxRate/km

export interface PricingConfig {
  minKm: number;
  maxKm: number;
  baseRate: number;
  maxRate: number;
  minFare: number;
  serviceFee: number;
  midTripCancellationFee: number;
  // Percent of the trip fare charged when a ride is cancelled before it starts
  // (e.g. no-show), 0–100.
  cancellationFeePercent: number;
  // Percent of the trip fare paid to the driver (0–100). The service fee
  // always goes to the platform.
  driverSharePercent: number;
  currency: string;
}

export const DEFAULT_PRICING: PricingConfig = {
  minKm: 7.5,
  maxKm: 30,
  baseRate: 1.0,
  maxRate: 1.25,
  minFare: 6,
  serviceFee: 1.5,
  midTripCancellationFee: 5,
  cancellationFeePercent: 20,
  driverSharePercent: 60,
  currency: "CAD",
};

// Active config — starts at defaults and is overridden once the admin-managed
// config/pricing document loads.
let activeConfig: PricingConfig = DEFAULT_PRICING;

// Live-binding exports: existing consumers of `SERVICE_FEE` /
// `MID_TRIP_CANCELLATION_FEE` keep working and automatically see admin updates
// (ES modules propagate reassignment of exported bindings to importers).
export let SERVICE_FEE = DEFAULT_PRICING.serviceFee;
export let MID_TRIP_CANCELLATION_FEE = DEFAULT_PRICING.midTripCancellationFee;

// Whether the admin-managed config has loaded at least once. Until it has, the
// UI should avoid showing fare/service-fee figures (they'd be the DEFAULT
// fallback, which can differ from what the admin set).
let pricingReady = false;
const readyListeners = new Set<() => void>();

export function isPricingReady(): boolean {
  return pricingReady;
}

/** Run `cb` once pricing has loaded (immediately if it already has). Returns an unsubscribe. */
export function onPricingReady(cb: () => void): () => void {
  if (pricingReady) {
    cb();
    return () => {};
  }
  readyListeners.add(cb);
  return () => readyListeners.delete(cb);
}

/** Replace the active pricing config (called by pricingService on load/update). */
export function setActivePricing(config: PricingConfig): void {
  activeConfig = config;
  SERVICE_FEE = config.serviceFee;
  MID_TRIP_CANCELLATION_FEE = config.midTripCancellationFee;
  if (!pricingReady) {
    pricingReady = true;
    readyListeners.forEach((cb) => cb());
    readyListeners.clear();
  }
}

export function getActivePricing(): PricingConfig {
  return activeConfig;
}

/**
 * Calculates the trip cost (excluding service fee) for a given distance.
 * Uses the active admin-managed config unless one is passed explicitly.
 *
 * Sliding per-km rate:
 *   ≤ minKm      → baseRate/km (a minFare floor applies)
 *   minKm–maxKm  → rate climbs linearly from baseRate to maxRate
 *   ≥ maxKm      → capped at maxRate/km
 */
export function calculateFare(
  distanceKm: number,
  config: PricingConfig = activeConfig,
): number {
  const span = config.maxKm - config.minKm;
  const rateSpan = config.maxRate - config.baseRate;

  let rate: number;
  if (!Number.isFinite(distanceKm) || distanceKm <= config.minKm) {
    rate = config.baseRate;
  } else if (distanceKm >= config.maxKm || span <= 0) {
    rate = config.maxRate;
  } else {
    rate = config.baseRate + ((distanceKm - config.minKm) / span) * rateSpan;
  }

  const fare = distanceKm * rate;
  return parseFloat(Math.max(config.minFare, fare).toFixed(2));
}

/**
 * Driver's payout for a given trip fare, per the active (admin-managed) share.
 * The service fee always goes to the platform, so it's excluded here.
 */
export function driverPayout(
  fare: number,
  config: PricingConfig = activeConfig,
): number {
  return parseFloat((fare * (config.driverSharePercent / 100)).toFixed(2));
}

/**
 * Fee charged when a ride is cancelled before it starts (e.g. no-show),
 * as a percent of the trip fare per the active (admin-managed) config.
 */
export function earlyCancellationFee(
  fare: number,
  config: PricingConfig = activeConfig,
): number {
  return parseFloat((fare * (config.cancellationFeePercent / 100)).toFixed(2));
}
