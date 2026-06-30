import { describe, it, expect } from "vitest";
import { getConfig } from "@/lib/config";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  AUTH_SECRET: "secret",
  S3_BUCKET: "bucket",
  USERS: JSON.stringify([{ username: "a", passwordHash: "h", role: "admin" }]),
} as NodeJS.ProcessEnv;

describe("getConfig", () => {
  it("parses USERS json and defaults", () => {
    const c = getConfig({ ...base });
    expect(c.users[0].username).toBe("a");
    expect(c.users[0].role).toBe("admin");
    expect(c.clusterDistanceKm).toBe(1.5);
    expect(c.clusterTimeGapHours).toBe(6);
  });

  it("throws when AUTH_SECRET missing", () => {
    const { AUTH_SECRET, ...rest } = base;
    expect(() => getConfig(rest as NodeJS.ProcessEnv)).toThrow(/AUTH_SECRET/);
  });

  it("throws when DATABASE_URL missing", () => {
    const { DATABASE_URL, ...rest } = base;
    expect(() => getConfig(rest as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
  });

  it("throws on invalid role", () => {
    const bad = { ...base, USERS: JSON.stringify([{ username: "a", passwordHash: "h", role: "x" }]) };
    expect(() => getConfig(bad as NodeJS.ProcessEnv)).toThrow(/role/);
  });
});
