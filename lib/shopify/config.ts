import { BillingError } from "@/lib/billing/types";

export const SHOPIFY_API_VERSION = "2024-10";
export const SHOPIFY_OAUTH_COOKIE = "bizpilot_shopify_oauth";
export const SHOPIFY_SCOPES = ["read_products", "read_inventory"] as const;
export const SHOPIFY_PRODUCT_PAGE_SIZE = 250;

export function shopifyCallbackUrl(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/api/app/shopify/callback`;
}

export function shopifyApiKey() {
  return process.env.SHOPIFY_API_KEY?.trim() || "";
}

export function shopifyApiSecret() {
  return process.env.SHOPIFY_API_SECRET?.trim() || "";
}

export function isShopifyOAuthConfigured() {
  return Boolean(
    shopifyApiKey() &&
      shopifyApiSecret() &&
      process.env.APP_URL?.trim() &&
      process.env.AUTH_SECRET?.trim(),
  );
}

export function requireShopifyOAuthConfig() {
  const apiKey = shopifyApiKey();
  const apiSecret = shopifyApiSecret();
  const appUrl = process.env.APP_URL?.trim() || "";
  if (!apiKey || !apiSecret || !appUrl) {
    throw new BillingError("Shopify is not configured.", "misconfigured");
  }
  return {
    apiKey,
    apiSecret,
    appUrl: appUrl.replace(/\/$/, ""),
    redirectUri: shopifyCallbackUrl(appUrl),
  };
}

export function normalizeShopDomain(input: string) {
  let value = input.trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    value = `${value}.myshopify.com`;
  }
  if (!/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]\.myshopify\.com$/.test(value) && !/^[a-z0-9]\.myshopify\.com$/.test(value)) {
    return null;
  }
  return value;
}

export function shopifyAuthorizeUrl(input: {
  shop: string;
  apiKey: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: input.apiKey,
    scope: SHOPIFY_SCOPES.join(","),
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  return `https://${input.shop}/admin/oauth/authorize?${params.toString()}`;
}
