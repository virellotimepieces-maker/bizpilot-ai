import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { requirePaidShopifyContext } from "@/lib/shopify/access";
import { decryptSecret } from "@/lib/gmail/token-crypto";
import { revokeShopifyToken } from "@/lib/shopify/api";
import { publicShopifyStatus } from "@/lib/shopify/public";
import { assertNoShopifySecrets } from "@/lib/shopify/public";

export async function GET() {
  try {
    const { store, workspace } = await requirePaidShopifyContext();
    const connection = await store.getShopifyConnection(workspace.id);
    const payload = publicShopifyStatus(connection);
    assertNoShopifySecrets(payload);
    return NextResponse.json(payload);
  } catch (error) {
    return jsonError(error, "Could not load Shopify status.");
  }
}

export async function DELETE() {
  try {
    const { store, workspace } = await requirePaidShopifyContext();
    const connection = await store.getShopifyConnection(workspace.id);
    if (connection) {
      try {
        const accessToken = decryptSecret(connection.encryptedAccessToken);
        await revokeShopifyToken({ shop: connection.shopDomain, accessToken });
      } catch {
        // Still disconnect locally if Shopify revoke fails.
      }
    }
    await store.deleteShopifyConnection(workspace.id);
    await store.upsertIntegrationConnection({
      workspaceId: workspace.id,
      provider: "shopify",
      status: "disconnected",
    });
    const payload = publicShopifyStatus(null);
    assertNoShopifySecrets(payload);
    return NextResponse.json(payload);
  } catch (error) {
    return jsonError(error, "Could not disconnect Shopify.");
  }
}

export async function POST() {
  return DELETE();
}
