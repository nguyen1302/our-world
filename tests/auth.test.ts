import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/lib/auth";

const secret = "test-secret-long-enough";

describe("auth tokens", () => {
  it("round-trips a session", async () => {
    const token = await createSessionToken({ username: "admin", role: "admin" }, secret);
    const session = await verifySessionToken(token, secret);
    expect(session).toEqual({ username: "admin", role: "admin" });
  });

  it("rejects a tampered token", async () => {
    const token = await createSessionToken({ username: "admin", role: "admin" }, secret);
    const tampered = token.slice(0, -2) + "xx";
    expect(await verifySessionToken(tampered, secret)).toBeNull();
  });

  it("rejects wrong secret", async () => {
    const token = await createSessionToken({ username: "a", role: "viewer" }, secret);
    expect(await verifySessionToken(token, "other-secret")).toBeNull();
  });

  it("returns null for undefined", async () => {
    expect(await verifySessionToken(undefined, secret)).toBeNull();
  });
});
