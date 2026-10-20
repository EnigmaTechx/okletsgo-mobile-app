import {
  clientStatusLabel,
  dropoffEtaLabel,
  fallbackEtaSeconds,
  pickupEtaLabel,
} from "./eta";

const base = {
  driverFirstName: "Marcus",
  pickup: { address: "A", lat: 43.45, lng: -80.5 },
  destination: { address: "B", lat: 43.5, lng: -80.5 },
};

describe("eta labels", () => {
  it("falls back to a straight-line estimate at 40 km/h", () => {
    // ~5.6 km north → ~8.3 min
    const secs = fallbackEtaSeconds(
      { lat: 43.45, lng: -80.5 },
      base.destination,
    );
    expect(secs).toBeGreaterThan(400);
    expect(secs).toBeLessThan(600);
    expect(fallbackEtaSeconds(null, base.destination)).toBeNull();
  });

  it("words pickup and drop-off differently", () => {
    expect(pickupEtaLabel(30)).toBe("Arriving now");
    expect(pickupEtaLabel(360)).toBe("Arriving in ~6 min");
    expect(pickupEtaLabel(null)).toBe("Driver on the way");
    expect(dropoffEtaLabel(null)).toBe("Trip in progress");
    expect(dropoffEtaLabel(600, new Date("2026-10-21T18:00:00"))).toMatch(
      /^Arriving at \d{1,2}:\d{2} (AM|PM)$/,
    );
  });

  it("explains a hand-off while pending", () => {
    expect(clientStatusLabel({ ...base, status: "pending" }, null)).toBe(
      "Waiting for driver…",
    );
    expect(
      clientStatusLabel(
        {
          ...base,
          status: "pending",
          forwardHistory: [
            {
              fromDriverId: "a",
              fromDriverFirstName: "Dave",
              toDriverId: "b",
              toDriverFirstName: "Marcus",
              reason: "busy",
              at: "",
            },
          ],
        },
        null,
      ),
    ).toBe("Dave can't take this one. Waiting for Marcus…");
    expect(
      clientStatusLabel({ ...base, status: "heading_to_pickup" }, 120),
    ).toBe("Arriving in ~2 min");
  });
});
