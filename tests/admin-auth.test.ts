import { describe, expect, it } from "vitest";
import {
  createAdminOtpReplayIdentifier,
  createAdminSessionToken,
  safeAdminReturnTo,
  verifyAdminSessionToken,
  verifyTotp,
} from "../lib/admin-auth";

describe("admin session security", () => {
  const secret = "test-secret-that-is-longer-than-thirty-two-characters";

  it("signs and verifies a valid session", async () => {
    const token = await createAdminSessionToken(secret);
    await expect(verifyAdminSessionToken(token, secret)).resolves.toBe(true);
  });

  it("rejects tampered sessions", async () => {
    const token = await createAdminSessionToken(secret);
    await expect(verifyAdminSessionToken(`${token}tampered`, secret)).resolves.toBe(false);
  });

  it("rejects unsafe admin return URLs", () => {
    expect(safeAdminReturnTo("//example.com/admin")).toBe("/admin");
    expect(safeAdminReturnTo("/admin\\example.com")).toBe("/admin");
    expect(safeAdminReturnTo("/boutique")).toBe("/admin");
    expect(safeAdminReturnTo("/admin/lots")).toBe("/admin/lots");
  });

  it("validates standard six-digit TOTP codes", async () => {
    await expect(verifyTotp("287082", "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).resolves.toBe(true);
    await expect(verifyTotp("000000", "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 59_000)).resolves.toBe(false);
  });

  it("derives a non-reversible replay key bound to the session secret", async () => {
    const first = await createAdminOtpReplayIdentifier("287082", secret);
    const repeated = await createAdminOtpReplayIdentifier("287082", secret);
    const rotated = await createAdminOtpReplayIdentifier("287082", `${secret}-rotated`);
    expect(first).toBe(repeated);
    expect(first).not.toBe(rotated);
    expect(first).not.toContain("287082");
  });

  it("invalidates sessions when admin credentials rotate", async () => {
    const previous = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "initial-admin-password";
    const token = await createAdminSessionToken(secret);
    process.env.ADMIN_PASSWORD = "rotated-admin-password";
    await expect(verifyAdminSessionToken(token, secret)).resolves.toBe(false);
    if (previous === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = previous;
  });
});
