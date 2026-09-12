import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import type { BillingStore } from "@/lib/billing/store";
import { BillingError, type GmailConnectionRecord, type WorkspaceRecord } from "@/lib/billing/types";
import { googleOAuthClientId, googleOAuthClientSecret, isGmailOAuthConfigured } from "./config";
import { gmailApiJson, refreshGoogleAccessToken } from "./google";
import { decryptSecret, encryptSecret } from "./token-crypto";

export async function requirePaidGmailContext() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspaces = await store.listWorkspacesForUser(userId);
  const workspace = workspaces[0];
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const paid = await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
  return { userId, store, ...paid };
}

async function markNeedsReconnect(store: BillingStore, workspaceId: string) {
  const existing = await store.getGmailConnection(workspaceId);
  if (!existing) return;
  await store.updateGmailConnection(workspaceId, { status: "needs_reconnect" });
}

async function refreshConnection(
  store: BillingStore,
  connection: GmailConnectionRecord,
): Promise<GmailConnectionRecord> {
  if (!isGmailOAuthConfigured()) {
    throw new BillingError("Gmail is not configured.", "misconfigured");
  }
  let refreshToken: string;
  try {
    refreshToken = decryptSecret(connection.encryptedRefreshToken);
  } catch {
    await markNeedsReconnect(store, connection.workspaceId);
    throw new BillingError("Gmail access was revoked or expired. Connect Gmail again.", "reconnect");
  }
  try {
    const tokens = await refreshGoogleAccessToken({
      refreshToken,
      clientId: googleOAuthClientId(),
      clientSecret: googleOAuthClientSecret(),
    });
    return store.updateGmailConnection(connection.workspaceId, {
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      accessTokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scope || connection.scopes,
      status: "connected",
    });
  } catch (error) {
    if (error instanceof BillingError && error.code === "reconnect") {
      await markNeedsReconnect(store, connection.workspaceId);
    }
    throw error;
  }
}

export async function requireGmailConnection(store: BillingStore, workspace: WorkspaceRecord) {
  const connection = await store.getGmailConnection(workspace.id);
  if (!connection) {
    throw new BillingError("Connect Gmail to load this inbox.", "not_found");
  }
  if (connection.status !== "connected") {
    throw new BillingError("Gmail access was revoked or expired. Connect Gmail again.", "reconnect");
  }
  return connection;
}

export async function withGmailAccessToken<T>(
  store: BillingStore,
  workspace: WorkspaceRecord,
  fn: (accessToken: string, connection: GmailConnectionRecord) => Promise<T>,
): Promise<T> {
  let connection = await requireGmailConnection(store, workspace);
  const expiringSoon = connection.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (expiringSoon) {
    connection = await refreshConnection(store, connection);
  }
  let accessToken: string;
  try {
    accessToken = decryptSecret(connection.encryptedAccessToken);
  } catch {
    connection = await refreshConnection(store, connection);
    accessToken = decryptSecret(connection.encryptedAccessToken);
  }
  try {
    return await fn(accessToken, connection);
  } catch (error) {
    if (error instanceof BillingError && error.code === "reconnect") {
      connection = await refreshConnection(store, connection);
      const retryToken = decryptSecret(connection.encryptedAccessToken);
      return fn(retryToken, connection);
    }
    throw error;
  }
}

export async function gmailGet<T>(
  store: BillingStore,
  workspace: WorkspaceRecord,
  path: string,
) {
  return withGmailAccessToken(store, workspace, (accessToken) =>
    gmailApiJson<T>({ accessToken, path }),
  );
}

export async function gmailPost<T>(
  store: BillingStore,
  workspace: WorkspaceRecord,
  path: string,
  body: unknown,
) {
  return withGmailAccessToken(store, workspace, (accessToken) =>
    gmailApiJson<T>({ accessToken, path, method: "POST", body }),
  );
}
