import { assertNoTokenFields } from "@/lib/gmail/public";
import { isShopifyOAuthConfigured } from "./config";
import type { ShopifyConnectionRecord, ShopifySyncStatus } from "./types";

export type PublicShopifyStatus = {
  configured: boolean;
  connected: boolean;
  connecting: boolean;
  needsReconnect: boolean;
  shopDomain: string | null;
  shopName: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: ShopifySyncStatus;
  lastSyncError: string | null;
  productCount: number;
  connectionError: string | null;
};

export function publicShopifyStatus(row: ShopifyConnectionRecord | null): PublicShopifyStatus {
  const connected = Boolean(row && row.status === "connected");
  const connecting = row?.status === "pending";
  const needsReconnect = row?.status === "needs_reconnect";
  const syncError = row?.lastSyncStatus === "error" ? row.lastSyncError : null;
  return {
    configured: isShopifyOAuthConfigured(),
    connected,
    connecting,
    needsReconnect,
    shopDomain: row?.shopDomain ?? null,
    shopName: row?.shopName || null,
    lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: row?.lastSyncStatus ?? "idle",
    lastSyncError: syncError,
    productCount: row?.productCount ?? 0,
    connectionError: needsReconnect
      ? "Shopify access was revoked or expired. Connect the store again."
      : null,
  };
}

export function shopifyStatusLabel(status: PublicShopifyStatus) {
  if (status.connecting) return "Connecting";
  if (status.needsReconnect || status.connectionError) return "Connection error";
  if (status.connected && status.lastSyncStatus === "syncing") return "Syncing";
  if (status.connected) return "Connected";
  if (!status.configured) return "Not configured";
  return "Not connected";
}

export function shopifyConnectionStatusForRow(row: ShopifyConnectionRecord | null) {
  if (!row) return "disconnected" as const;
  if (row.status === "connected") return "connected" as const;
  if (row.status === "pending") return "pending" as const;
  return "disconnected" as const;
}

export function assertNoShopifySecrets(payload: unknown) {
  const raw = JSON.stringify(payload);
  if (/encryptedAccessToken|shpat_|shpua_|SHOPIFY_API_SECRET|client_secret/i.test(raw)) {
    throw new Error("Shopify payload leaked a credential field.");
  }
  assertNoTokenFields(payload);
}
