import { randomBytes } from "node:crypto";
import type { BillingStore } from "@/lib/billing/store";
import { BillingService } from "@/lib/billing/service";
import { BillingError, type SocialAccountRecord } from "@/lib/billing/types";
import { decryptSecret, encryptSecret } from "@/lib/gmail/token-crypto";
import { isSocialOAuthPlatform, socialPlatformConfig, type SocialOAuthPlatform } from "./platforms";
import { createSocialOAuthState, readSocialOAuthState, type SocialOAuthState } from "./oauth-state";
import {
  createSocialPkce,
  exchangeSocialAuthorization,
  revokeSocialAccess,
  socialAuthorizeUrl,
  type SocialDestination,
  type SocialFetch,
} from "./providers";
import { assertSocialRateLimit } from "./rate-limit";

export function socialReturnPath(value: string | null): "/app/integrations" | "/app/social" {
  return value === "/app/social" ? "/app/social" : "/app/integrations";
}

export async function beginSocialConnect(input: {
  userId: string;
  workspaceId: string;
  platform: string;
  returnTo: "/app/integrations" | "/app/social";
}) {
  if (!isSocialOAuthPlatform(input.platform)) {
    throw new BillingError("Choose a supported social platform.", "invalid");
  }
  const config = socialPlatformConfig(input.platform);
  if (!config.configured) throw new BillingError(`${config.label} is not configured.`, "misconfigured");
  const pkce = createSocialPkce();
  const state = await createSocialOAuthState({
    userId: input.userId,
    workspaceId: input.workspaceId,
    platform: input.platform,
    nonce: randomBytes(16).toString("base64url"),
    returnTo: input.returnTo,
    codeVerifier: pkce.verifier,
  });
  return {
    state,
    url: socialAuthorizeUrl({
      platform: input.platform,
      state,
      codeChallenge: pkce.challenge,
    }),
  };
}

function destinationMetadata(destinations: SocialDestination[]) {
  return JSON.stringify({
    destinations: destinations.map((row) => ({ id: row.id, name: row.name, type: row.type })),
  });
}

async function saveAuthorization(
  store: BillingStore,
  workspaceId: string,
  platform: SocialOAuthPlatform,
  authorization: Awaited<ReturnType<typeof exchangeSocialAuthorization>>,
) {
  if (authorization.destinations.length === 0) {
    return "none" as const;
  }
  if (authorization.destinations.length > 1) {
    await store.upsertSocialAccount({
      workspaceId,
      platform,
      status: "pending_selection",
      scopes: authorization.scopes,
      encryptedRefreshToken: authorization.refreshToken ? encryptSecret(authorization.refreshToken) : "",
      accessTokenExpiresAt: authorization.expiresAt,
      pendingDestinationsEnc: encryptSecret(JSON.stringify(authorization.destinations)),
      metadataJson: destinationMetadata(authorization.destinations),
    });
    return "select" as const;
  }
  const destination = authorization.destinations[0]!;
  await store.upsertSocialAccount({
    workspaceId,
    platform,
    status: "connected",
    externalAccountId: destination.id,
    accountName: destination.name,
    accountType: destination.type,
    scopes: authorization.scopes,
    encryptedAccessToken: encryptSecret(destination.token),
    encryptedRefreshToken: authorization.refreshToken ? encryptSecret(authorization.refreshToken) : "",
    accessTokenExpiresAt: authorization.expiresAt,
    pendingDestinationsEnc: "",
    metadataJson: "{}",
  });
  return "connected" as const;
}

export async function acceptSocialOAuthCallback(input: {
  platform: string;
  sessionUserId: string | null;
  code: string | null;
  queryState: string | null;
  cookieState: string | null;
  queryError: string | null;
  store: BillingStore;
  fetchImpl?: SocialFetch;
  now?: Date;
}) {
  const fallback = "/app/integrations" as const;
  if (!input.sessionUserId) return { returnTo: fallback, query: "social=signin" };
  if (!isSocialOAuthPlatform(input.platform)) return { returnTo: fallback, query: "social=error" };
  if (input.queryError) {
    return {
      returnTo: fallback,
      query: input.queryError === "access_denied" ? "social=denied" : "social=error",
    };
  }
  if (!input.code || !input.queryState || !input.cookieState || input.queryState !== input.cookieState) {
    return { returnTo: fallback, query: "social=error" };
  }
  const state = await readSocialOAuthState(input.queryState);
  if (!state || state.userId !== input.sessionUserId || state.platform !== input.platform) {
    return { returnTo: fallback, query: "social=error" };
  }
  const membership = await input.store.getMembership(state.userId, state.workspaceId);
  if (!membership) return { returnTo: state.returnTo, query: "social=error" };
  try {
    await new BillingService(input.store).requirePaidWorkspace(state.userId, state.workspaceId, input.now);
  } catch (error) {
    if (error instanceof BillingError && error.code === "inactive") {
      return { returnTo: state.returnTo, query: "social=inactive" };
    }
    return { returnTo: state.returnTo, query: "social=error" };
  }
  const config = socialPlatformConfig(input.platform);
  if (!config.configured) return { returnTo: state.returnTo, query: `social=setup&platform=${input.platform}` };
  try {
    assertSocialRateLimit(state.workspaceId, "connect", input.now);
    const authorization = await exchangeSocialAuthorization({
      platform: input.platform,
      code: input.code,
      codeVerifier: state.codeVerifier,
      fetchImpl: input.fetchImpl,
      now: input.now,
    });
    const result = await saveAuthorization(input.store, state.workspaceId, input.platform, authorization);
    if (result === "none") return { returnTo: state.returnTo, query: `social=none&platform=${input.platform}` };
    return { returnTo: state.returnTo, query: `social=${result}&platform=${input.platform}` };
  } catch (error) {
    console.error("social_oauth_failed", input.platform);
    if (error instanceof BillingError && error.code === "misconfigured") {
      return { returnTo: state.returnTo, query: `social=setup&platform=${input.platform}` };
    }
    return { returnTo: state.returnTo, query: `social=error&platform=${input.platform}` };
  }
}

export async function selectSocialDestination(input: {
  store: BillingStore;
  workspaceId: string;
  platform: string;
  destinationId: string;
}) {
  if (!isSocialOAuthPlatform(input.platform)) {
    throw new BillingError("Choose a supported social platform.", "invalid");
  }
  const row = await input.store.getSocialAccount(input.workspaceId, input.platform);
  if (!row || row.status !== "pending_selection" || !row.pendingDestinationsEnc) {
    throw new BillingError("Choose a destination from the authorized accounts.", "invalid");
  }
  let destinations: SocialDestination[] = [];
  try {
    const parsed = JSON.parse(decryptSecret(row.pendingDestinationsEnc)) as SocialDestination[];
    destinations = Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new BillingError("Reconnect the account and choose a destination again.", "reconnect");
  }
  const destination = destinations.find((item) => item.id === input.destinationId && item.token);
  if (!destination) throw new BillingError("That destination is not part of this connection.", "invalid");
  await input.store.upsertSocialAccount({
    workspaceId: input.workspaceId,
    platform: input.platform,
    status: "connected",
    externalAccountId: destination.id,
    accountName: destination.name,
    accountType: destination.type,
    scopes: row.scopes,
    encryptedAccessToken: encryptSecret(destination.token),
    encryptedRefreshToken: row.encryptedRefreshToken,
    accessTokenExpiresAt: row.accessTokenExpiresAt,
    pendingDestinationsEnc: "",
    metadataJson: "{}",
  });
}

export async function disconnectSocialAccount(input: {
  store: BillingStore;
  workspaceId: string;
  platform: string;
  fetchImpl?: SocialFetch;
}) {
  if (!isSocialOAuthPlatform(input.platform)) {
    throw new BillingError("Choose a supported social platform.", "invalid");
  }
  const row = await input.store.getSocialAccount(input.workspaceId, input.platform);
  if (!row) return false;
  const token = decryptStored(row.encryptedAccessToken) || decryptStored(row.encryptedRefreshToken);
  if (token) {
    await revokeSocialAccess({ platform: input.platform, accessToken: token, fetchImpl: input.fetchImpl });
  }
  return input.store.deleteSocialAccount(input.workspaceId, input.platform);
}

function decryptStored(value: string) {
  if (!value) return "";
  try {
    return decryptSecret(value);
  } catch {
    return "";
  }
}

export async function markSocialReconnect(store: BillingStore, row: SocialAccountRecord) {
  await store.upsertSocialAccount({
    workspaceId: row.workspaceId,
    platform: row.platform,
    status: "needs_reconnect",
    externalAccountId: row.externalAccountId,
    accountName: row.accountName,
    accountType: row.accountType,
    scopes: row.scopes,
    encryptedAccessToken: "",
    encryptedRefreshToken: "",
    accessTokenExpiresAt: null,
    pendingDestinationsEnc: "",
    metadataJson: "{}",
  });
}

export type { SocialOAuthState };
