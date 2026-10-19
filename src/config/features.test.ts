import { FEATURE_CATALOGUE, isFeatureVisible, type FeatureFlagsDoc } from "./features";

const client = { uid: "c1", role: "client" as const };
const driver = { uid: "d1", role: "driver" as const };

describe("isFeatureVisible", () => {
  it("hides everything when the document is missing", () => {
    for (const f of FEATURE_CATALOGUE) {
      expect(isFeatureVisible(null, f.key, client)).toBe(false);
      expect(isFeatureVisible(undefined, f.key, driver)).toBe(false);
    }
  });

  it("hides a key that is missing, 'none', or unrecognised", () => {
    const flags = {
      driver_earnings: { audience: "none" },
      payment: { audience: "everyone" },
    } as unknown as FeatureFlagsDoc;
    expect(isFeatureVisible(flags, "driver_earnings", driver)).toBe(false);
    expect(isFeatureVisible(flags, "payment", driver)).toBe(false);
    expect(isFeatureVisible(flags, "book_for_others", client)).toBe(false);
  });

  it("hides everything for a signed-out user", () => {
    const flags: FeatureFlagsDoc = { payment: { audience: "all" } };
    expect(isFeatureVisible(flags, "payment", null)).toBe(false);
  });

  it("'all' shows to every supported role only", () => {
    const flags: FeatureFlagsDoc = {
      payment: { audience: "all" },
      driver_earnings: { audience: "all" },
    };
    expect(isFeatureVisible(flags, "payment", client)).toBe(true);
    expect(isFeatureVisible(flags, "payment", driver)).toBe(true);
    // drivers-only feature: "all" still never reaches a client
    expect(isFeatureVisible(flags, "driver_earnings", driver)).toBe(true);
    expect(isFeatureVisible(flags, "driver_earnings", client)).toBe(false);
  });

  it("'clients' / 'drivers' pick one role", () => {
    const flags: FeatureFlagsDoc = {
      payment: { audience: "clients" },
      driver_earnings: { audience: "clients" }, // nonsense combo → nobody
    };
    expect(isFeatureVisible(flags, "payment", client)).toBe(true);
    expect(isFeatureVisible(flags, "payment", driver)).toBe(false);
    expect(isFeatureVisible(flags, "driver_earnings", driver)).toBe(false);

    const flags2: FeatureFlagsDoc = { payment: { audience: "drivers" } };
    expect(isFeatureVisible(flags2, "payment", driver)).toBe(true);
    expect(isFeatureVisible(flags2, "payment", client)).toBe(false);
  });

  it("'selected' matches by uid and tolerates a missing list", () => {
    const flags: FeatureFlagsDoc = {
      driver_earnings: { audience: "selected", userIds: ["d1"] },
      payment: { audience: "selected" },
    };
    expect(isFeatureVisible(flags, "driver_earnings", driver)).toBe(true);
    expect(
      isFeatureVisible(flags, "driver_earnings", { uid: "d2", role: "driver" }),
    ).toBe(false);
    expect(isFeatureVisible(flags, "payment", client)).toBe(false);
  });
});
