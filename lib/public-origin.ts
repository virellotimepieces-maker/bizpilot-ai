export const PRODUCTION_PUBLIC_ORIGIN = "https://www.mybizpilotai.com";
export const PRODUCTION_WIDGET_ORIGIN = PRODUCTION_PUBLIC_ORIGIN;

export const LEGACY_WIDGET_ORIGINS = [
  "https://bizpilot-ai-mocha.vercel.app",
  "https://mybizpilotai.com",
] as const;

export function crawlerUserAgent(product: "BizPilotVerify" | "BizPilotWebsiteIndexer") {
  return `Mozilla/5.0 (compatible; ${product}/1.0; +${PRODUCTION_PUBLIC_ORIGIN}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36`;
}

export function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0";
}

export function canonicalPublicOrigin(appUrl?: string) {
  const trimmed = appUrl?.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const origin = new URL(withProtocol).origin;
    if (isLocalHostname(new URL(origin).hostname)) return null;
    if (new URL(origin).protocol !== "https:") return null;
    return origin;
  } catch {
    return null;
  }
}
