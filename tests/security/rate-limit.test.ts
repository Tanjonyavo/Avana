import { describe, expect, it } from "vitest";
import { LocalRateLimiter } from "@/lib/server/local-rate-limit";

describe("bounded local abuse protection", () => {
  it("enforces each quota until its original expiration", () => {
    const limiter = new LocalRateLimiter();
    expect(limiter.allowed("a", 2, 60, 0)).toBe(true);
    expect(limiter.allowed("a", 2, 60, 1)).toBe(true);
    expect(limiter.allowed("a", 2, 60, 59_999)).toBe(false);
    expect(limiter.allowed("a", 2, 60, 60_000)).toBe(true);
  });

  it("refuses identifier flooding without evicting existing quotas", () => {
    const limiter = new LocalRateLimiter(2);
    expect(limiter.allowed("victim", 1, 600, 0)).toBe(true);
    expect(limiter.allowed("attacker-1", 1, 600, 1)).toBe(true);
    for (let index = 2; index < 100; index += 1) {
      expect(limiter.allowed(`attacker-${index}`, 1, 600, index)).toBe(false);
    }
    expect(limiter.allowed("victim", 1, 600, 100)).toBe(false);
  });

  it("reclaims expired identifiers while preserving live limits", () => {
    const limiter = new LocalRateLimiter(2);
    expect(limiter.allowed("expired", 1, 30, 0)).toBe(true);
    expect(limiter.allowed("live", 1, 600, 0)).toBe(true);
    expect(limiter.allowed("new", 1, 60, 60_000)).toBe(true);
    expect(limiter.allowed("live", 1, 600, 60_001)).toBe(false);
  });
});
