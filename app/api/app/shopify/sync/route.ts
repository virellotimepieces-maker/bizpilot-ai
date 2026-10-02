import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { requirePaidShopifyContext, requireShopifyConnection } from "@/lib/shopify/access";
import { publicShopifyStatus } from "@/lib/shopify/public";
import { assertNoShopifySecrets } from "@/lib/shopify/public";
import { syncShopifyCatalog } from "@/lib/shopify/sync";

export async function POST() {
  try {
    const { store, workspace } = await requirePaidShopifyContext();
    const connection = await requireShopifyConnection(store, workspace);
    const updated = await syncShopifyCatalog(store, connection);
    const payload = publicShopifyStatus(updated);
    assertNoShopifySecrets(payload);
    return NextResponse.json(payload);
  } catch (error) {
    return jsonError(error, "Could not sync the Shopify catalog.");
  }
}
