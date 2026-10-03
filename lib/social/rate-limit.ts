import { BillingError } from "@/lib/billing/types";

const buckets = new Map<string, number[]>();

export function assertSocialRateLimit(workspaceId: string, action: "publish" | "connect", now = new Date()) {
  const limit = action === "publish" ? 8 : 20;
  const key = `${action}:${workspaceId}`;
  const stamps = (buckets.get(key) ?? []).filter((stamp) => now.getTime() - stamp < 60_000);
  if (stamps.length >= limit) {
    throw new BillingError("Too many social requests. Wait a minute and try again.", "limit");
  }
  stamps.push(now.getTime());
  buckets.set(key, stamps);
}

export function resetSocialRateLimits() {
  buckets.clear();
}
