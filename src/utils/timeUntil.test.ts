import { timeUntil } from "./timeUntil";

const now = new Date(2026, 9, 8, 13, 42); // 1:42 PM local
const plus = (min: number) =>
  new Date(now.getTime() + min * 60000).toISOString();

describe("timeUntil", () => {
  it("minutes, hours, days", () => {
    expect(timeUntil(plus(48), now)).toBe("in 48 min");
    expect(timeUntil(plus(60), now)).toBe("in 1 h");
    expect(timeUntil(plus(130), now)).toBe("in 2 h 10 min");
    expect(timeUntil(plus(60 * 23), now)).toBe("in 23 h");
    expect(timeUntil(plus(60 * 26), now)).toBe("tomorrow");
    expect(timeUntil(plus(60 * 24 * 3), now)).toBe("in 3 days");
  });

  it("around and past the pickup time", () => {
    expect(timeUntil(plus(0), now)).toBe("now");
    expect(timeUntil(plus(-5), now)).toBe("now");
    expect(timeUntil(plus(-20), now)).toBe("overdue");
  });

  it("tolerates bad input", () => {
    expect(timeUntil("", now)).toBe("");
    expect(timeUntil("not a date", now)).toBe("");
  });
});
