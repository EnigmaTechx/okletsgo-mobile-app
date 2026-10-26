import {
  accountQualifiesForWelcome,
  distanceDiscount,
  isPromoLive,
  kmBank,
  normalisePromotions,
  personalise,
  promoAppliesTo,
  type PromotionItem,
} from "./promotions";

const NOW = Date.parse("2026-10-26T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

const welcome: PromotionItem = {
  id: "welcome-2026",
  kind: "welcome",
  audience: "clients",
  active: true,
  badge: "Welcome gift",
  title: "Your first ride is on us, {firstName}.",
  body: "Up to 10 km free.",
  ctaLabel: "Book a ride",
  ctaRoute: "book",
  couponCode: "WELCOME10KM",
  maxFreeKm: 10,
  newAccountDays: 30,
  startsAt: null,
  endsAt: null,
};

describe("normalisePromotions", () => {
  it("fails closed on a missing document", () => {
    const c = normalisePromotions(undefined);
    expect(c.items).toEqual([]);
    expect(c.kmRewards).toEqual({
      enabled: false,
      kmPerCredit: 200,
      creditKm: 10,
    });
  });

  it("keeps well-formed items and drops the rest", () => {
    const c = normalisePromotions({
      items: [
        { ...welcome, couponCode: "welcome10km", ctaRoute: "https://x" },
        { id: "no-title", kind: "info" },
        { id: "bad-kind", kind: "sale", title: "x" },
        null,
      ],
      kmRewards: { enabled: true, kmPerCredit: 150, creditKm: 0 },
    });
    expect(c.items).toHaveLength(1);
    expect(c.items[0].couponCode).toBe("WELCOME10KM");
    expect(c.items[0].ctaRoute).toBeNull();
    expect(c.items[0].audience).toBe("clients");
    expect(c.kmRewards).toEqual({
      enabled: true,
      kmPerCredit: 150,
      creditKm: 10,
    });
  });
});

describe("isPromoLive", () => {
  it("respects the switch and the window", () => {
    expect(isPromoLive(welcome, NOW)).toBe(true);
    expect(isPromoLive({ ...welcome, active: false }, NOW)).toBe(false);
    expect(
      isPromoLive({ ...welcome, startsAt: "2026-11-01T00:00:00Z" }, NOW),
    ).toBe(false);
    expect(
      isPromoLive({ ...welcome, endsAt: "2026-10-01T00:00:00Z" }, NOW),
    ).toBe(false);
    expect(
      isPromoLive(
        {
          ...welcome,
          startsAt: "2026-10-01T00:00:00Z",
          endsAt: "2026-12-31T23:59:59Z",
        },
        NOW,
      ),
    ).toBe(true);
  });
});

describe("promoAppliesTo", () => {
  it("matches the audience to the role", () => {
    expect(promoAppliesTo(welcome, "client")).toBe(true);
    expect(promoAppliesTo(welcome, "driver")).toBe(false);
    expect(promoAppliesTo({ ...welcome, audience: "drivers" }, "driver")).toBe(
      true,
    );
    expect(promoAppliesTo({ ...welcome, audience: "all" }, "driver")).toBe(
      true,
    );
    expect(promoAppliesTo(welcome, undefined)).toBe(false);
  });
});

describe("accountQualifiesForWelcome", () => {
  const fresh = {
    role: "client" as const,
    createdAt: new Date(NOW - 3 * DAY).toISOString(),
  };
  it("takes a young client account", () => {
    expect(accountQualifiesForWelcome(welcome, fresh, NOW)).toBe(true);
  });
  it("turns away old accounts, drivers and items without a coupon", () => {
    expect(
      accountQualifiesForWelcome(
        welcome,
        { ...fresh, createdAt: new Date(NOW - 31 * DAY).toISOString() },
        NOW,
      ),
    ).toBe(false);
    expect(
      accountQualifiesForWelcome(welcome, { ...fresh, role: "driver" }, NOW),
    ).toBe(false);
    expect(
      accountQualifiesForWelcome({ ...welcome, couponCode: null }, fresh, NOW),
    ).toBe(false);
  });
  it("has no age limit when newAccountDays is unset", () => {
    expect(
      accountQualifiesForWelcome(
        { ...welcome, newAccountDays: null },
        { ...fresh, createdAt: "2020-01-01T00:00:00Z" },
        NOW,
      ),
    ).toBe(true);
  });
});

describe("personalise", () => {
  it("fills in the first name or drops the placeholder cleanly", () => {
    expect(personalise(welcome.title, "Sarah")).toBe(
      "Your first ride is on us, Sarah.",
    );
    expect(personalise(welcome.title, "")).toBe("Your first ride is on us.");
    expect(personalise("Hi {firstName}!", null)).toBe("Hi !");
  });
});

describe("distanceDiscount", () => {
  const fareFor = (km: number) => km * 1.0;
  it("covers the whole fare on a short trip", () => {
    expect(distanceDiscount(8.5, 8.5, 10, fareFor)).toBe(8.5);
  });
  it("covers the first N km on a long trip", () => {
    expect(distanceDiscount(31.25, 25, 10, fareFor)).toBe(10);
  });
  it("never exceeds the fare and is zero without a cap", () => {
    expect(distanceDiscount(6, 25, 10, () => 50)).toBe(6);
    expect(distanceDiscount(6, 25, 0, fareFor)).toBe(0);
  });
});

describe("kmBank", () => {
  const cfg = { enabled: true, kmPerCredit: 200, creditKm: 10 };
  it("banks one credit per 200 km and keeps unspent ones", () => {
    expect(kmBank({ totalKmTravelled: 434, rewardKmRedeemed: 0 }, cfg)).toEqual(
      {
        credits: 2,
        freeKm: 20,
        progressKm: 34,
        kmPerCredit: 200,
        creditKm: 10,
      },
    );
  });
  it("subtracts spent credits and never goes negative", () => {
    expect(
      kmBank({ totalKmTravelled: 434, rewardKmRedeemed: 2 }, cfg).credits,
    ).toBe(0);
    expect(
      kmBank({ totalKmTravelled: 100, rewardKmRedeemed: 3 }, cfg).credits,
    ).toBe(0);
    expect(kmBank(null, cfg)).toMatchObject({ credits: 0, progressKm: 0 });
  });
});
