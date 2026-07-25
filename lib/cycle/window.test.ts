import { describe, expect, it } from "vitest";
import { cycleWindow, daysUntil, memberSince } from "./window";

describe("cycleWindow", () => {
  it("weekly window spans 7 days from team creation", () => {
    const created = "2026-07-01T00:00:00Z";
    const now = new Date("2026-07-03T12:00:00Z");
    const w = cycleWindow(created, "weekly", null, now);
    expect(w.start.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("monthly window spans 30 days", () => {
    const w = cycleWindow(
      "2026-07-01T00:00:00Z",
      "monthly",
      null,
      new Date("2026-07-15T00:00:00Z"),
    );
    expect(w.end.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("rolls forward past elapsed unsettled windows so the open window contains now", () => {
    const w = cycleWindow(
      "2026-07-01T00:00:00Z",
      "weekly",
      null,
      new Date("2026-07-20T00:00:00Z"), // two full weeks elapsed
    );
    expect(w.start.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-07-22T00:00:00.000Z");
  });

  it("starts from last settlement end when provided", () => {
    const w = cycleWindow(
      "2026-07-01T00:00:00Z",
      "weekly",
      "2026-07-10T00:00:00Z",
      new Date("2026-07-12T00:00:00Z"),
    );
    expect(w.start.toISOString()).toBe("2026-07-10T00:00:00.000Z");
  });
});

describe("memberSince [RT-H3]", () => {
  it("member joined before window -> window start", () => {
    const s = memberSince("2026-06-01T00:00:00Z", new Date("2026-07-01T00:00:00Z"));
    expect(s.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("mid-cycle join -> join instant, never retroactive", () => {
    const s = memberSince("2026-07-05T09:30:00Z", new Date("2026-07-01T00:00:00Z"));
    expect(s.toISOString()).toBe("2026-07-05T09:30:00.000Z");
  });
});

describe("daysUntil", () => {
  it("counts up, never negative", () => {
    expect(daysUntil(new Date("2026-07-08T00:00:00Z"), new Date("2026-07-05T12:00:00Z"))).toBe(3);
    expect(daysUntil(new Date("2026-07-01T00:00:00Z"), new Date("2026-07-05T00:00:00Z"))).toBe(0);
  });
});
