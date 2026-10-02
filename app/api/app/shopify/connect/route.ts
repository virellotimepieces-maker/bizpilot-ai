import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { requirePaidShopifyContext } from "@/lib/shopify/access";
import {
  isShopifyOAuthConfigured,
  normalizeShopDomain,
  requireShopifyOAuthConfig,
  shopifyAuthorizeUrl,
  SHOPIFY_OAUTH_COOKIE,
} from "@/lib/shopify/config";
import { createShopifyOAuthState, shopifyOAuthCookieOptions } from "@/lib/shopify/oauth-state";

export async function POST(request: NextRequest) {
  try {
    const { userId, store, workspace } = await requirePaidShopifyContext();
    if (!isShopifyOAuthConfigured()) {
      throw new BillingError("Shopify is not configured.", "misconfigured");
    }
    const body = (await request.json().catch(() => ({}))) as { shop?: string };
    const shop = normalizeShopDomain(body.shop ?? "");
    if (!shop) {
      throw new BillingError("Enter a valid myshopify.com store domain.", "invalid");
    }
    const existingShop = await store.getShopifyConnectionByShop(shop);
    if (existingShop && existingShop.workspaceId !== workspace.id) {
      throw new BillingError("That Shopify store is already connected to another BizPilot workspace.", "conflict");
    }
    const { apiKey, redirectUri } = requireShopifyOAuthConfig();
    const state = await createShopifyOAuthState({
      userId,
      workspaceId: workspace.id,
      shop,
      nonce: randomBytes(16).toString("base64url"),
    });
    await store.upsertIntegrationConnection({
      workspaceId: workspace.id,
      provider: "shopify",
      status: "pending",
    });
    const response = NextResponse.json({
      authorizeUrl: shopifyAuthorizeUrl({ shop, apiKey, redirectUri, state }),
    });
    response.cookies.set(SHOPIFY_OAUTH_COOKIE, state, shopifyOAuthCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error, "Could not start Shopify connection.");
  }
}
