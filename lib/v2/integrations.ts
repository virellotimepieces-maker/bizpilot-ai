import { assertNoTokenFields, type PublicGmailStatus } from "@/lib/gmail/public";
import {
  assertNoShopifySecrets,
  publicShopifyStatus,
  shopifyStatusLabel,
  type PublicShopifyStatus,
} from "@/lib/shopify/public";
import { type FutureIntegrationProvider } from "./enums";
import type { IntegrationConnectionRecord } from "./types";

export const INTEGRATIONS_HINT =
  "Gmail is the live inbox connection. Social is drafts you post yourself. Shopify catalog sync is available when the store is connected. WooCommerce and Calendar stay not connected until a real integration exists.";

export const FUTURE_INTEGRATION_CATALOG = [
  {
    provider: "woocommerce",
    name: "WooCommerce",
    detail: "Order support is not connected. Catalog data is not pulled from WooCommerce.",
  },
  {
    provider: "calendar",
    name: "Calendar",
    detail:
      "Appointment requests stay in this workspace. BizPilot does not confirm a slot on a calendar.",
  },
] as const satisfies readonly {
  provider: Exclude<FutureIntegrationProvider, "shopify">;
  name: string;
  detail: string;
}[];

export type GmailIntegrationStatus = PublicGmailStatus & {
  label: string;
  href: "/app/email";
};

export type ShopifyIntegrationStatus = PublicShopifyStatus & {
  label: string;
};

export type SocialIntegrationStatus = {
  status: "drafts_only";
  label: "Drafts only";
  href: "/app/social";
};

export type FutureIntegrationStatus = {
  provider: Exclude<FutureIntegrationProvider, "shopify">;
  name: string;
  status: "disconnected";
  label: "Not connected";
  detail: string;
};

export type WorkspaceIntegrations = {
  gmail: GmailIntegrationStatus;
  shopify: ShopifyIntegrationStatus;
  social: SocialIntegrationStatus;
  future: FutureIntegrationStatus[];
};

export function gmailStatusLabel(status: PublicGmailStatus): string {
  if (status.needsReconnect) return "Needs reconnect";
  if (status.connected) return "Connected";
  if (!status.configured) return "Not configured";
  return "Not connected";
}

export function displayFutureIntegrationStatus(
  row?: Pick<IntegrationConnectionRecord, "status"> | null,
): "disconnected" {
  return row?.status === "connected" || row?.status === "pending" ? "disconnected" : "disconnected";
}

export function buildWorkspaceIntegrations(input: {
  gmail: PublicGmailStatus;
  shopify?: PublicShopifyStatus | null;
  connections?: IntegrationConnectionRecord[];
}): WorkspaceIntegrations {
  const byProvider = new Map((input.connections ?? []).map((row) => [row.provider, row]));
  const shopify = input.shopify ?? publicShopifyStatus(null);
  return {
    gmail: {
      ...input.gmail,
      label: gmailStatusLabel(input.gmail),
      href: "/app/email",
    },
    shopify: {
      ...shopify,
      label: shopifyStatusLabel(shopify),
    },
    social: {
      status: "drafts_only",
      label: "Drafts only",
      href: "/app/social",
    },
    future: FUTURE_INTEGRATION_CATALOG.map((item) => ({
      provider: item.provider,
      name: item.name,
      status: displayFutureIntegrationStatus(byProvider.get(item.provider)),
      label: "Not connected",
      detail: item.detail,
    })),
  };
}

export function serializeWorkspaceIntegrations(row: WorkspaceIntegrations) {
  const payload = {
    gmail: {
      configured: row.gmail.configured,
      connected: row.gmail.connected,
      needsReconnect: row.gmail.needsReconnect,
      googleEmail: row.gmail.googleEmail,
      connectedAt: row.gmail.connectedAt,
      label: row.gmail.label,
      href: row.gmail.href,
    },
    shopify: {
      configured: row.shopify.configured,
      connected: row.shopify.connected,
      connecting: row.shopify.connecting,
      needsReconnect: row.shopify.needsReconnect,
      shopDomain: row.shopify.shopDomain,
      shopName: row.shopify.shopName,
      lastSyncedAt: row.shopify.lastSyncedAt,
      lastSyncStatus: row.shopify.lastSyncStatus,
      lastSyncError: row.shopify.lastSyncError,
      productCount: row.shopify.productCount,
      connectionError: row.shopify.connectionError,
      label: row.shopify.label,
    },
    social: {
      status: row.social.status,
      label: row.social.label,
      href: row.social.href,
    },
    future: row.future.map((item) => ({
      provider: item.provider,
      name: item.name,
      status: "disconnected" as const,
      label: "Not connected" as const,
      detail: item.detail,
    })),
  };
  assertNoShopifySecrets(payload);
  assertNoTokenFields(payload);
  return payload;
}

export type SerializedWorkspaceIntegrations = ReturnType<typeof serializeWorkspaceIntegrations>;
