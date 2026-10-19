import { DEFAULT_STORE_URL, evaluateUpdateGate } from "./appUpdateService";

describe("evaluateUpdateGate", () => {
  it("gates only when this build is below the platform minimum", () => {
    const config = { minBuild: { android: 34, ios: 34 } };
    expect(evaluateUpdateGate("android", 33, config).updateRequired).toBe(true);
    expect(evaluateUpdateGate("android", 34, config).updateRequired).toBe(false);
    expect(evaluateUpdateGate("ios", 40, config).updateRequired).toBe(false);
  });

  it("fails open with no config, no build number or an unknown platform", () => {
    expect(evaluateUpdateGate("android", 1, null).updateRequired).toBe(false);
    expect(evaluateUpdateGate("android", null, { minBuild: { android: 99 } }).updateRequired).toBe(false);
    expect(evaluateUpdateGate("web", 1, { minBuild: { android: 99 } }).updateRequired).toBe(false);
  });

  it("uses the configured store url, else the platform default", () => {
    expect(evaluateUpdateGate("ios", 1, { storeUrl: { ios: "https://x" } }).storeUrl).toBe("https://x");
    expect(evaluateUpdateGate("ios", 1, null).storeUrl).toBe(DEFAULT_STORE_URL.ios);
    expect(evaluateUpdateGate("android", 1, null).storeUrl).toBe(DEFAULT_STORE_URL.android);
  });

  it("tolerates string numbers written from the console", () => {
    const config = { minBuild: { android: "35" as unknown as number } };
    expect(evaluateUpdateGate("android", 34, config)).toMatchObject({ updateRequired: true, minBuild: 35 });
  });
});
