import type { BillingStore } from "@/lib/billing/store";
import { BillingError } from "@/lib/billing/types";
import { fetchAllShopifyProducts, fetchShopifyShop } from "./api";
import { mapShopifyAdminProduct } from "./catalog";
import { decryptSecret } from "@/lib/gmail/token-crypto";
import type { ShopifyConnectionRecord } from "./types";

export async function syncShopifyCatalog(
  store: BillingStore,
  connection: ShopifyConnectionRecord,
) {
  if (connection.status !== "connected") {
    throw new BillingError("Connect Shopify before syncing the catalog.", "invalid");
  }
  const accessToken = decryptSecret(connection.encryptedAccessToken);
  await store.updateShopifyConnection(connection.workspaceId, {
    lastSyncStatus: "syncing",
    lastSyncError: null,
  });
  try {
    const shop = await fetchShopifyShop({ shop: connection.shopDomain, accessToken });
    const raw = await fetchAllShopifyProducts({ shop: connection.shopDomain, accessToken });
    const mapped = raw
      .map((product) => mapShopifyAdminProduct(product, connection.workspaceId, shop.primaryDomain))
      .filter((row): row is NonNullable<typeof row> => Boolean(row));
    await store.replaceShopifyProducts(connection.workspaceId, mapped);
    return store.updateShopifyConnection(connection.workspaceId, {
      shopName: shop.name,
      primaryDomain: shop.primaryDomain,
      lastSyncedAt: new Date(),
      lastSyncStatus: "success",
      lastSyncError: null,
      productCount: mapped.length,
    });
  } catch (error) {
    const message =
      error instanceof BillingError
        ? error.message
        : "Shopify catalog sync failed. Connect the store again if this continues.";
    const status = error instanceof BillingError && error.code === "reconnect" ? "needs_reconnect" : connection.status;
    await store.updateShopifyConnection(connection.workspaceId, {
      status,
      lastSyncStatus: "error",
      lastSyncError: message,
    });
    throw error;
  }
}
