// Local fallback for unconfigured development/demo environments. Live instances
// share their limits through the check_rate_limit database RPC.
export class LocalRateLimiter {
  private readonly attempts = new Map<string, { count: number; resetAt: number }>();
  private nextCleanupAt = 0;

  constructor(private readonly maximumKeys = 10_000) {}

  allowed(key: string, maximum: number, windowSeconds: number, now = Date.now()) {
    if (now >= this.nextCleanupAt) {
      for (const [identifier, attempt] of this.attempts) {
        if (attempt.resetAt <= now) this.attempts.delete(identifier);
      }
      this.nextCleanupAt = now + 60_000;
    }
    const current = this.attempts.get(key);
    if (!current || current.resetAt <= now) {
      // Do not evict an active limit: rotating identifiers must not reset it.
      if (!current && this.attempts.size >= this.maximumKeys) return false;
      this.attempts.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return true;
    }
    if (current.count >= maximum) return false;
    current.count += 1;
    return true;
  }
}
