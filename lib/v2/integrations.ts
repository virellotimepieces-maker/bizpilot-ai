import { assertNoCalendarSecrets, publicCalendarStatus, type PublicCalendarStatus } from "@/lib/calendar/public";
import { assertNoTokenFields, type PublicGmailStatus } from "@/lib/gmail/public";
import {
  assertNoShopifySecrets,
  publicShopifyStatus,
  shopifyStatusLabel,
  type PublicShopifyStatus,
} from "@/lib/shopify/public";
import type { SocialAccountRecord } from "@/lib/billing/types";
import {
  assertNoSocialSecrets,
  publicSocialAccounts,
  summarizeSocialAccounts,
  type PublicSocialAccount,
} from "@/lib/social/public";
import { type FutureIntegrationProvider } from "./enums";
import type { IntegrationConnectionRecord } from "./types";

export const INTEGRATIONS_HINT =
  "Gmail is the live inbox connection. Social drafts stay in BizPilot until you confirm a publish to a connected account. Shopify catalog sync is available when the store is connected. Google Calendar books appointments for this workspace when it is connected. WooCommerce stays not connected.";

export const FUTURE_INTEGRATION_CATALOG = [
  {
    provider: "woocommerce",
    name: "WooCommerce",
    detail: "Order support is not connected. Catalog data is not pulled from WooCommerce.",
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
  status: "setup_required" | "not_connected" | "connected" | "needs_reconnect" | "pending_selection";
  label: string;
  href: "/app/social";
  accounts: PublicSocialAccount[];
};

export type CalendarIntegrationStatus = PublicCalendarStatus & {
  label: string;
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
  calendar: CalendarIntegrationStatus;
  future: FutureIntegrationStatus[];
};

export function calendarStatusLabel(status: PublicCalendarStatus): string {
  if (status.needsReconnect) return "Needs reconnect";
  if (status.connected) return "Connected";
  if (!status.configured) return "Not configured";
  return "Not connected";
}

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
  calendar?: PublicCalendarStatus | null;
  connections?: IntegrationConnectionRecord[];
  socialAccounts?: SocialAccountRecord[];
}): WorkspaceIntegrations {
  const byProvider = new Map((input.connections ?? []).map((row) => [row.provider, row]));
  const shopify = input.shopify ?? publicShopifyStatus(null);
  const calendar = input.calendar ?? publicCalendarStatus(null, null);
  const accounts = publicSocialAccounts(input.socialAccounts ?? []);
  const social = summarizeSocialAccounts(accounts);
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
      status: social.status,
      label: social.label,
      href: "/app/social",
      accounts,
    },
    calendar: {
      ...calendar,
      label: calendarStatusLabel(calendar),
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
      accounts: row.social.accounts.map((account) => ({
        platform: account.platform,
        label: account.label,
        connection: account.connection,
        configured: account.configured,
        missing: account.missing,
        setupNotes: account.setupNotes,
        accountName: account.accountName,
        accountType: account.accountType,
        requiredPermission: account.requiredPermission,
        hasPermission: account.hasPermission,
        media: account.media,
        destinations: account.destinations,
        copyAvailable: account.copyAvailable,
      })),
    },
    calendar: {
      configured: row.calendar.configured,
      connected: row.calendar.connected,
      needsReconnect: row.calendar.needsReconnect,
      googleEmail: row.calendar.googleEmail,
      calendarId: row.calendar.calendarId,
      calendarSummary: row.calendar.calendarSummary,
      connectedAt: row.calendar.connectedAt,
      settings: row.calendar.settings,
      label: row.calendar.label,
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
  assertNoCalendarSecrets(payload);
  assertNoSocialSecrets(payload);
  return payload;
}

export type SerializedWorkspaceIntegrations = ReturnType<typeof serializeWorkspaceIntegrations>;
