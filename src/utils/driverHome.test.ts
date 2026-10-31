import type { RideRequest } from "../interfaces/ride";
import { dispatchChip, splitDriverHome } from "./driverHome";

const ride = (
  id: string,
  status: RideRequest["status"],
  scheduledTime: string,
  extra: Partial<RideRequest> = {},
): RideRequest =>
  ({
    id,
    status,
    scheduledTime,
    clientId: "c",
    clientFirstName: "Jane",
    clientLastName: "D",
    driverId: "me",
    pickup: { address: "A" },
    destination: { address: "B" },
    createdAt: scheduledTime,
    estimatedPrice: 10,
    distance: 5,
    paymentStatus: "paid_direct",
    ...extra,
  }) as RideRequest;

const now = new Date("2026-10-31T15:00:00"); // local time, a Saturday

describe("splitDriverHome", () => {
  it("pins today's and tomorrow's requests, mixes later ones into coming up", () => {
    const out = splitDriverHome(
      [
        ride("live", "in_progress", "2026-10-31T14:00:00"),
        ride("today", "pending", "2026-10-31T19:00:00"),
        ride("tmrw", "pending", "2026-11-01T09:00:00"),
        ride("later", "pending", "2026-11-03T09:00:00"),
        ride("acc", "accepted", "2026-11-02T09:00:00"),
        ride("notime", "pending", ""),
      ],
      now,
    );
    expect(out.live.map((r) => r.id)).toEqual(["live"]);
    expect(out.needsResponse.map((r) => r.id)).toEqual([
      "notime",
      "today",
      "tmrw",
    ]);
    expect(out.comingUp.map((r) => r.id)).toEqual(["acc", "later"]);
    expect(out.nextPickup?.id).toBe("acc");
    expect(out.todayRequests).toBe(2); // "today" and the one with no time
  });
});

describe("dispatchChip", () => {
  const base = ride("r", "pending", "2026-10-31T19:00:00", {
    dispatcherId: "me",
    dispatchDeadline: "2026-10-31T15:06:30",
    dispatchFallback: "assign_next",
  });
  it("counts down the dispatcher's own fallback", () => {
    expect(dispatchChip(base, "me", now.getTime())).toBe(
      "Auto-assigns in 7 min",
    );
    expect(
      dispatchChip(
        { ...base, dispatchFallback: "remind" },
        "me",
        now.getTime(),
      ),
    ).toBe("Reminder in 7 min");
  });
  it("is silent for other drivers, keep-waiting and past deadlines", () => {
    expect(dispatchChip(base, "other", now.getTime())).toBeNull();
    expect(
      dispatchChip(
        { ...base, dispatchFallback: "keep_waiting" },
        "me",
        now.getTime(),
      ),
    ).toBeNull();
    expect(dispatchChip(base, "me", now.getTime() + 60 * 60 * 1000)).toBeNull();
  });
});
