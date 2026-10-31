import { chatAvailable, chatIsOpen, unreadFor } from "./chat";
import type { RideRequest } from "../interfaces/ride";

const t0 = new Date("2026-10-31T20:00:00Z").getTime();
const ride = (p: Partial<RideRequest>): RideRequest => p as RideRequest;

describe("chatIsOpen", () => {
  it("is open during the trip", () => {
    for (const status of [
      "heading_to_pickup",
      "arrived",
      "in_progress",
    ] as const)
      expect(chatIsOpen(ride({ status }), t0)).toBe(true);
  });
  it("is closed before the driver sets off", () => {
    expect(chatIsOpen(ride({ status: "pending" }), t0)).toBe(false);
    expect(chatIsOpen(ride({ status: "accepted" }), t0)).toBe(false);
  });
  it("stays open 15 minutes after a completed trip", () => {
    const done = ride({
      status: "completed",
      completedAt: new Date(t0 - 10 * 60000).toISOString(),
    });
    expect(chatIsOpen(done, t0)).toBe(true);
    expect(chatIsOpen(done, t0 + 10 * 60000)).toBe(false);
  });
  it("never opens for a ride cancelled before the trip started", () => {
    const c = ride({
      status: "cancelled",
      cancelledAt: new Date(t0 - 60000).toISOString(),
    });
    expect(chatIsOpen(c, t0)).toBe(false);
    expect(
      chatIsOpen(
        { ...c, headedToPickupAt: new Date(t0 - 3600e3).toISOString() },
        t0,
      ),
    ).toBe(true);
  });
});

describe("chatAvailable / unreadFor", () => {
  it("keeps a closed chat readable once something was said", () => {
    expect(
      chatAvailable(
        ride({ status: "completed", completedAt: "2020-01-01" }),
        t0,
      ),
    ).toBe(false);
    expect(
      chatAvailable(
        ride({
          status: "completed",
          completedAt: "2020-01-01",
          chatLastAt: "2020-01-01",
        }),
        t0,
      ),
    ).toBe(true);
  });
  it("reads my unread count", () => {
    expect(unreadFor(ride({ chatUnread: { me: 3 } }), "me")).toBe(3);
    expect(unreadFor(ride({ chatUnread: { me: 3 } }), "you")).toBe(0);
    expect(unreadFor(null, "me")).toBe(0);
  });
});
