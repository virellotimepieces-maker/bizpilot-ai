import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingError } from "@/lib/billing/types";
import { encryptSecret } from "@/lib/gmail/token-crypto";
import { exchangeShopifyAuthorizationCode, fetchShopifyShop } from "@/lib/shopify/api";
import { SHOPIFY_OAUTH_COOKIE, SHOPIFY_SCOPES, requireShopifyOAuthConfig } from "@/lib/shopify/config";
import { verifyShopifyCallbackHmac } from "@/lib/shopify/hmac";
import { readShopifyOAuthState } from "@/lib/shopify/oauth-state";
import { normalizeShopDomain } from "@/lib/shopify/config";
import { syncShopifyCatalog } from "@/lib/shopify/sync";

function redirectToIntegrations(origin: string, query: string) {
  const response = NextResponse.redirect(new URL(`/app/integrations?${query}`, origin));
  response.cookies.delete(SHOPIFY_OAUTH_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return redirectToIntegrations(origin, "shopify=signin");
    }
    const denied = request.nextUrl.searchParams.get("error");
    if (denied) {
      return redirectToIntegrations(origin, "shopify=denied");
    }
    const { apiKey, apiSecret } = requireShopifyOAuthConfig();
    if (!verifyShopifyCallbackHmac(request.nextUrl.searchParams, apiSecret)) {
      return redirectToIntegrations(origin, "shopify=error");
    }
    const code = request.nextUrl.searchParams.get("code");
    const shop = normalizeShopDomain(request.nextUrl.searchParams.get("shop") ?? "");
    const stateParam = request.nextUrl.searchParams.get("state");
    const cookieState = request.cookies.get(SHOPIFY_OAUTH_COOKIE)?.value;
    if (!code || !shop || !stateParam || !cookieState || cookieState !== stateParam) {
      return redirectToIntegrations(origin, "shopify=error");
    }
    const state = await readShopifyOAuthState(stateParam);
    if (!state || state.userId !== userId || state.shop !== shop) {
      return redirectToIntegrations(origin, "shopify=error");
    }
    const store = getBillingStore();
    const membership = await store.getMembership(userId, state.workspaceId);
    if (!membership) {
      return redirectToIntegrations(origin, "shopify=error");
    }
    const existingShop = await store.getShopifyConnectionByShop(shop);
    if (existingShop && existingShop.workspaceId !== state.workspaceId) {
      return redirectToIntegrations(origin, "shopify=conflict");
    }
    const tokens = await exchangeShopifyAuthorizationCode({
      shop,
      code,
      apiKey,
      apiSecret,
    });
    const shopInfo = await fetchShopifyShop({ shop, accessToken: tokens.accessToken });
    const connection = await store.upsertShopifyConnection({
      workspaceId: state.workspaceId,
      shopDomain: shop,
      shopName: shopInfo.name,
      primaryDomain: shopInfo.primaryDomain,
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      scopes: tokens.scope || SHOPIFY_SCOPES.join(","),
      status: "connected",
      lastSyncStatus: "idle",
      lastSyncError: null,
    });
    await store.upsertIntegrationConnection({
      workspaceId: state.workspaceId,
      provider: "shopify",
      status: "connected",
    });
    try {
      await syncShopifyCatalog(store, connection);
    } catch {
      return redirectToIntegrations(origin, "shopify=connected&sync=error");
    }
    return redirectToIntegrations(origin, "shopify=connected");
  } catch (error) {
    if (error instanceof BillingError && error.code === "misconfigured") {
      return redirectToIntegrations(origin, "shopify=misconfigured");
    }
    return redirectToIntegrations(origin, "shopify=error");
  }
}
