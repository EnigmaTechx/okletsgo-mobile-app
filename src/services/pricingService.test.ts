import { coercePricing } from "./pricingService";
import { DEFAULT_PRICING, calculateFare } from "../utils/fareCalculator";

describe("coercePricing", () => {
  it("fills every missing or invalid field from the defaults", () => {
    expect(coercePricing(undefined)).toEqual(DEFAULT_PRICING);
    const partial = coercePricing({ baseRate: 1.1, maxRate: "oops", currency: "  " });
    expect(partial.baseRate).toBe(1.1);
    expect(partial.maxRate).toBe(DEFAULT_PRICING.maxRate);
    expect(partial.currency).toBe("CAD");
  });

  it("keeps the capped-distance formula in agreement with the Ionic app", () => {
    const cfg = coercePricing({ minKm: 7.5, maxKm: 30, baseRate: 1, maxRate: 1.25, minFare: 6 });
    expect(calculateFare(5, cfg)).toBe(6); // floored at minFare
    expect(calculateFare(7.5, cfg)).toBe(7.5); // baseRate up to minKm
    expect(calculateFare(30, cfg)).toBe(37.5); // capped at maxRate
    expect(calculateFare(18.75, cfg)).toBe(21.09); // halfway up the ramp: 1.125/km
  });
});
