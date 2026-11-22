/** In-memory token bucket keyed by an arbitrary string (single backend process). */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAt: number }>();

  constructor(
    private readonly ratePerSecond: number,
    private readonly burst: number,
    private readonly now: () => number = Date.now
  ) {}

  take(key: string): boolean {
    const current = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.burst, updatedAt: current };
    const refilled = Math.min(
      this.burst,
      bucket.tokens + ((current - bucket.updatedAt) / 1000) * this.ratePerSecond
    );
    const allowed = refilled >= 1;
    this.buckets.set(key, { tokens: allowed ? refilled - 1 : refilled, updatedAt: current });

    if (this.buckets.size > 10_000) {
      this.buckets.clear();
    }
    return allowed;
  }
}

/** Counts events per key per calendar day (UTC); resets when the day changes. */
export class DailyQuota {
  private day = "";
  private readonly counts = new Map<string, number>();

  constructor(
    private readonly limit: number,
    private readonly now: () => Date = () => new Date()
  ) {}

  take(key: string): boolean {
    const today = this.now().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.counts.clear();
    }
    const used = this.counts.get(key) ?? 0;
    if (used >= this.limit) {
      return false;
    }
    this.counts.set(key, used + 1);
    return true;
  }
}

/** Real client IP behind nginx (backend only listens on 127.0.0.1, nginx sets X-Real-IP). */
export function clientIp(request: { ip: string; headers: Record<string, string | string[] | undefined> }): string {
  const realIp = request.headers["x-real-ip"];
  return (Array.isArray(realIp) ? realIp[0] : realIp)?.trim() || request.ip;
}
