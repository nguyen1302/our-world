import { describe, it, expect } from "vitest";
import { haversineKm, pickMemory, type MemoryBounds } from "@/lib/cluster";

describe("haversineKm", () => {
  it("zero for same point", () => {
    expect(haversineKm({ lat: 10, lng: 10 }, { lat: 10, lng: 10 })).toBeCloseTo(0);
  });
  it("~111km per degree latitude", () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeGreaterThan(110);
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeLessThan(112);
  });
});

const cfg = { distanceKm: 1.5, gapHours: 6 };
const base = new Date("2026-06-30T09:00:00Z");

const mem: MemoryBounds = {
  id: "m1",
  lat: 11.94,
  lng: 108.45,
  startAt: new Date("2026-06-30T08:00:00Z"),
  endAt: new Date("2026-06-30T08:30:00Z"),
};

describe("pickMemory", () => {
  it("attaches a nearby photo within time gap", () => {
    expect(pickMemory([mem], { lat: 11.941, lng: 108.451, takenAt: base }, cfg)).toBe("m1");
  });

  it("creates new memory when far away", () => {
    expect(
      pickMemory([mem], { lat: 21.0, lng: 105.8, takenAt: base }, cfg),
    ).toBeNull();
  });

  it("creates new memory when time gap exceeded", () => {
    const late = new Date("2026-06-30T20:00:00Z"); // >6h after endAt
    expect(pickMemory([mem], { lat: 11.941, lng: 108.451, takenAt: late }, cfg)).toBeNull();
  });

  it("picks the closest-in-time match", () => {
    const mem2: MemoryBounds = {
      id: "m2",
      lat: 11.9405,
      lng: 108.4505,
      startAt: new Date("2026-06-30T08:55:00Z"),
      endAt: new Date("2026-06-30T09:05:00Z"),
    };
    expect(pickMemory([mem, mem2], { lat: 11.94, lng: 108.45, takenAt: base }, cfg)).toBe("m2");
  });
});
