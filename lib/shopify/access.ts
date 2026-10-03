import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { selectOperatingWorkspace } from "@/lib/billing/operating-workspace";
import { BillingService } from "@/lib/billing/service";
import type { BillingStore } from "@/lib/billing/store";
import { BillingError, type WorkspaceRecord } from "@/lib/billing/types";
import { decryptSecret } from "@/lib/gmail/token-crypto";
import { isShopifyOAuthConfigured } from "./config";
import type { ShopifyConnectionRecord } from "./types";

export async function requirePaidShopifyContext() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspace = await selectOperatingWorkspace(store, userId);
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const paid = await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
  return { userId, store, ...paid };
}

export async function requireShopifyConnection(store: BillingStore, workspace: WorkspaceRecord) {
  const connection = await store.getShopifyConnection(workspace.id);
  if (!connection) {
    throw new BillingError("Connect Shopify to sync this catalog.", "not_found");
  }
  if (connection.status !== "connected") {
    throw new BillingError("Shopify access was revoked or expired. Connect Shopify again.", "reconnect");
  }
  if (!isShopifyOAuthConfigured()) {
    throw new BillingError("Shopify is not configured.", "misconfigured");
  }
  return connection;
}

export async function withShopifyAccessToken<T>(
  store: BillingStore,
  workspace: WorkspaceRecord,
  fn: (accessToken: string, connection: ShopifyConnectionRecord) => Promise<T>,
): Promise<T> {
  const connection = await requireShopifyConnection(store, workspace);
  let accessToken: string;
  try {
    accessToken = decryptSecret(connection.encryptedAccessToken);
  } catch {
    await store.updateShopifyConnection(workspace.id, { status: "needs_reconnect" });
    throw new BillingError("Shopify access was revoked or expired. Connect Shopify again.", "reconnect");
  }
  return fn(accessToken, connection);
}
