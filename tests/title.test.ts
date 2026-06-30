import { describe, it, expect } from "vitest";
import { buildTitle, formatDateRange } from "@/lib/title";

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m - 1, day, 8));

describe("formatDateRange", () => {
  it("single day", () => {
    expect(formatDateRange(d(2026, 6, 30), d(2026, 6, 30))).toBe("30/06/2026");
  });
  it("same month range", () => {
    expect(formatDateRange(d(2026, 6, 29), d(2026, 6, 30))).toBe("29–30/06/2026");
  });
  it("cross month range", () => {
    expect(formatDateRange(d(2026, 6, 30), d(2026, 7, 1))).toBe("30/06/2026 – 01/07/2026");
  });
});

describe("buildTitle", () => {
  it("place + range", () => {
    expect(buildTitle({ placeName: "Đà Lạt", startAt: d(2026, 6, 29), endAt: d(2026, 6, 30) })).toBe(
      "Đà Lạt · 29–30/06/2026",
    );
  });
  it("falls back to city", () => {
    expect(buildTitle({ city: "Hà Nội", startAt: d(2026, 6, 30), endAt: d(2026, 6, 30) })).toBe(
      "Hà Nội · 30/06/2026",
    );
  });
  it("no place -> just range", () => {
    expect(buildTitle({ startAt: d(2026, 6, 30), endAt: d(2026, 6, 30) })).toBe("30/06/2026");
  });
});
