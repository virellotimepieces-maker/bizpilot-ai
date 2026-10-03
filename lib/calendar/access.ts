import type { BillingStore } from "@/lib/billing/store";
import { BillingError } from "@/lib/billing/types";
import { decryptSecret, encryptSecret } from "@/lib/gmail/token-crypto";
import { isCalendarOAuthConfigured, requireCalendarOAuthConfig } from "./config";
import { refreshCalendarAccessToken } from "./google";
import type { GoogleCalendarConnectionRecord } from "./types";

async function markNeedsReconnect(store: BillingStore, workspaceId: string) {
  const existing = await store.getGoogleCalendarConnection(workspaceId);
  if (!existing || existing.status === "needs_reconnect") return;
  await store.updateGoogleCalendarConnection(workspaceId, { status: "needs_reconnect" });
}

export async function refreshStoredCalendarAccess(
  store: BillingStore,
  connection: GoogleCalendarConnectionRecord,
  fetchImpl: typeof fetch = fetch,
) {
  if (connection.status !== "connected") {
    throw new BillingError("Google Calendar access was revoked or expired. Connect Google Calendar again.", "reconnect");
  }
  let refreshToken = "";
  try {
    refreshToken = decryptSecret(connection.encryptedRefreshToken);
  } catch {
    console.error(
      JSON.stringify({ source: "calendar-oauth", event: "refresh_token_unreadable", workspaceId: connection.workspaceId }),
    );
    await markNeedsReconnect(store, connection.workspaceId);
    throw new BillingError("Google Calendar access was revoked or expired. Connect Google Calendar again.", "reconnect");
  }
  if (!isCalendarOAuthConfigured()) {
    throw new BillingError("Google Calendar is not configured.", "misconfigured");
  }
  try {
    const { clientId, clientSecret } = requireCalendarOAuthConfig();
    const tokens = await refreshCalendarAccessToken({ refreshToken, clientId, clientSecret }, fetchImpl);
    await store.updateGoogleCalendarConnection(connection.workspaceId, {
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      accessTokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scope || connection.scopes,
      status: "connected",
    });
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof BillingError && error.code === "reconnect") {
      await markNeedsReconnect(store, connection.workspaceId);
    }
    throw error;
  }
}

export async function calendarAccessToken(
  store: BillingStore,
  connection: GoogleCalendarConnectionRecord,
  fetchImpl: typeof fetch = fetch,
) {
  if (connection.status !== "connected") {
    throw new BillingError("Google Calendar access was revoked or expired. Connect Google Calendar again.", "reconnect");
  }
  const expiring = connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (!expiring) {
    try {
      return decryptSecret(connection.encryptedAccessToken);
    } catch {
      console.error(
        JSON.stringify({ source: "calendar-oauth", event: "access_token_unreadable", workspaceId: connection.workspaceId }),
      );
    }
  }
  return refreshStoredCalendarAccess(store, connection, fetchImpl);
}
