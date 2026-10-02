import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyShopifyCallbackHmac(searchParams: URLSearchParams, secret: string) {
  const hmac = searchParams.get("hmac");
  if (!hmac || !secret) return false;
  const message = [...searchParams.entries()]
    .filter(([key]) => key !== "hmac" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const digest = createHmac("sha256", secret).update(message).digest("hex");
  const left = Buffer.from(digest, "utf8");
  const right = Buffer.from(hmac, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
