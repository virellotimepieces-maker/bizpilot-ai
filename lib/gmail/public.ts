import type { GmailConnectionRecord } from "@/lib/billing/types";
import { isGmailOAuthConfigured } from "./config";

export type PublicGmailStatus = {
  configured: boolean;
  connected: boolean;
  needsReconnect: boolean;
  googleEmail: string | null;
  connectedAt: string | null;
};

export function publicGmailStatus(row: GmailConnectionRecord | null): PublicGmailStatus {
  const connected = Boolean(row && row.status === "connected");
  return {
    configured: isGmailOAuthConfigured(),
    connected,
    needsReconnect: row?.status === "needs_reconnect",
    googleEmail: row?.googleEmail ?? null,
    connectedAt: row?.connectedAt?.toISOString() ?? null,
  };
}

export function assertNoTokenFields(payload: unknown) {
  const raw = JSON.stringify(payload);
  if (
    /encryptedRefreshToken|encryptedAccessToken|refresh_token|access_token|client_secret|GOOGLE_CLIENT_SECRET/i.test(
      raw,
    )
  ) {
    throw new Error("Gmail payload leaked a credential field.");
  }
}
