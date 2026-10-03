import type { SocialAccountRecord } from "@/lib/billing/types";
import {
  SOCIAL_OAUTH_PLATFORMS,
  socialPlatformConfig,
  type SocialMediaMode,
  type SocialOAuthPlatform,
} from "./platforms";

export type SocialConnectionState =
  | "connected"
  | "not_connected"
  | "setup_required"
  | "needs_reconnect"
  | "pending_selection";

export type PublicSocialDestination = {
  id: string;
  name: string;
  type: string;
};

export type PublicSocialAccount = {
  platform: SocialOAuthPlatform;
  label: string;
  connection: SocialConnectionState;
  configured: boolean;
  missing: string[];
  setupNotes: string[];
  accountName: string;
  accountType: string;
  requiredPermission: string;
  hasPermission: boolean;
  media: SocialMediaMode;
  destinations: PublicSocialDestination[];
  copyAvailable: true;
};

export function readPublicDestinations(metadataJson: string): PublicSocialDestination[] {
  try {
    const parsed = JSON.parse(metadataJson) as {
      destinations?: { id?: unknown; name?: unknown; type?: unknown }[];
    };
    return (parsed.destinations ?? [])
      .filter((row) => typeof row.id === "string" && typeof row.name === "string")
      .map((row) => ({
        id: row.id as string,
        name: row.name as string,
        type: typeof row.type === "string" ? row.type : "",
      }));
  } catch {
    return [];
  }
}

function scopesInclude(scopes: string, permission: string) {
  return scopes
    .split(/[\s,]+/)
    .map((scope) => scope.trim().toLowerCase())
    .filter(Boolean)
    .includes(permission.toLowerCase());
}

export function publicSocialAccount(
  platform: SocialOAuthPlatform,
  row: SocialAccountRecord | null,
): PublicSocialAccount {
  const config = socialPlatformConfig(platform);
  let connection: SocialConnectionState = "not_connected";
  if (!config.configured) connection = "setup_required";
  else if (row?.status === "connected") connection = "connected";
  else if (row?.status === "needs_reconnect") connection = "needs_reconnect";
  else if (row?.status === "pending_selection") connection = "pending_selection";
  const hasPermission = Boolean(row && scopesInclude(row.scopes, config.requiredPermission));
  return {
    platform,
    label: config.label,
    connection,
    configured: config.configured,
    missing: config.missing,
    setupNotes: config.setupNotes,
    accountName: row?.accountName ?? "",
    accountType: row?.accountType ?? "",
    requiredPermission: config.requiredPermission,
    hasPermission,
    media: config.media,
    destinations: connection === "pending_selection" ? readPublicDestinations(row?.metadataJson ?? "") : [],
    copyAvailable: true,
  };
}

export function publicSocialAccounts(rows: SocialAccountRecord[]) {
  return SOCIAL_OAUTH_PLATFORMS.map((platform) =>
    publicSocialAccount(platform, rows.find((row) => row.platform === platform) ?? null),
  );
}

export function summarizeSocialAccounts(accounts: PublicSocialAccount[]) {
  if (accounts.some((account) => account.connection === "connected")) {
    return { status: "connected" as const, label: "Connected" };
  }
  if (accounts.some((account) => account.connection === "needs_reconnect")) {
    return { status: "needs_reconnect" as const, label: "Needs reconnect" };
  }
  if (accounts.some((account) => account.connection === "pending_selection")) {
    return { status: "pending_selection" as const, label: "Choose an account" };
  }
  if (accounts.some((account) => account.configured && account.connection === "not_connected")) {
    return { status: "not_connected" as const, label: "Not connected" };
  }
  return { status: "setup_required" as const, label: "Setup required" };
}

export function assertNoSocialSecrets(payload: unknown) {
  const raw = JSON.stringify(payload);
  if (/encryptedAccessToken|encryptedRefreshToken|pendingDestinationsEnc|access_token|refresh_token/i.test(raw)) {
    throw new Error("Social payload leaked a credential field.");
  }
}
