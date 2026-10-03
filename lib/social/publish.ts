import { randomUUID } from "node:crypto";
import type { BillingStore } from "@/lib/billing/store";
import { BillingService } from "@/lib/billing/service";
import { BillingError, type SocialAccountRecord } from "@/lib/billing/types";
import { decryptSecret, encryptSecret } from "@/lib/gmail/token-crypto";
import { isSocialOAuthPlatform, type SocialOAuthPlatform } from "./platforms";
import { evaluateSocialPublish } from "./publish-policy";
import { publicSocialAccount } from "./public";
import { markSocialReconnect } from "./connect";
import { publishToSocialPlatform, refreshSocialAccessToken, type SocialFetch } from "./providers";
import { assertSocialRateLimit } from "./rate-limit";

function decryptStored(value: string) {
  if (!value) return "";
  try {
    return decryptSecret(value);
  } catch {
    return "";
  }
}

async function accessTokenFor(input: {
  store: BillingStore;
  row: SocialAccountRecord;
  platform: SocialOAuthPlatform;
  fetchImpl: SocialFetch;
  now: Date;
}) {
  const accessToken = decryptStored(input.row.encryptedAccessToken);
  if (!accessToken) {
    await markSocialReconnect(input.store, input.row);
    throw new BillingError(`Reconnect ${input.platform}.`, "reconnect");
  }
  const expiresAt = input.row.accessTokenExpiresAt;
  if (!expiresAt || expiresAt.getTime() - input.now.getTime() > 60_000) return accessToken;
  const refreshToken =
    decryptStored(input.row.encryptedRefreshToken) || (input.platform === "threads" ? accessToken : "");
  if (!refreshToken || input.platform === "facebook" || input.platform === "instagram") {
    await markSocialReconnect(input.store, input.row);
    throw new BillingError(`Reconnect ${input.platform}. The saved authorization expired.`, "reconnect");
  }
  try {
    const next = await refreshSocialAccessToken({
      platform: input.platform,
      refreshToken,
      fetchImpl: input.fetchImpl,
      now: input.now,
    });
    await input.store.upsertSocialAccount({
      workspaceId: input.row.workspaceId,
      platform: input.row.platform,
      status: "connected",
      externalAccountId: input.row.externalAccountId,
      accountName: input.row.accountName,
      accountType: input.row.accountType,
      scopes: input.row.scopes,
      encryptedAccessToken: encryptSecret(next.accessToken),
      encryptedRefreshToken: next.refreshToken ? encryptSecret(next.refreshToken) : "",
      accessTokenExpiresAt: next.expiresAt,
      pendingDestinationsEnc: "",
      metadataJson: "{}",
    });
    return next.accessToken;
  } catch (error) {
    console.error("social_refresh_failed", input.platform);
    await markSocialReconnect(input.store, input.row);
    if (error instanceof BillingError) throw error;
    throw new BillingError(`Reconnect ${input.platform}. The saved authorization expired.`, "reconnect");
  }
}

function publicMediaUrl(appUrl: string, token: string) {
  const origin = appUrl.trim().replace(/\/$/, "");
  if (!origin.startsWith("https://")) {
    throw new BillingError("Image publishing needs the public https app URL.", "misconfigured");
  }
  return `${origin}/api/public/social-media/${token}`;
}

export async function publishApprovedSocialDraft(input: {
  store: BillingStore;
  workspaceId: string;
  widgetKey: string;
  userId: string;
  messageId: string;
  confirm: boolean;
  appUrl: string;
  fetchImpl?: SocialFetch;
  now?: Date;
}) {
  if (input.confirm !== true) {
    throw new BillingError("Confirm the post before publishing.", "invalid");
  }
  const now = input.now ?? new Date();
  const service = new BillingService(input.store);
  await service.requirePaidWorkspace(input.userId, input.workspaceId, now);
  const message = await input.store.getSocialMessage(input.messageId, input.workspaceId, input.widgetKey);
  if (!message) throw new BillingError("Social draft not found.", "not_found");
  if (!isSocialOAuthPlatform(message.platform)) {
    throw new BillingError("This platform cannot be published.", "invalid");
  }
  const platform = message.platform;
  const account = await input.store.getSocialAccount(input.workspaceId, platform);
  const decision = evaluateSocialPublish({
    status: message.status,
    subscriptionActive: true,
    hasMedia: Boolean(message.mediaAssetId),
    account: publicSocialAccount(platform, account),
  });
  if (!decision.ok) throw new BillingError(decision.reason, "invalid");
  if (!account) throw new BillingError("Connect the social account before publishing.", "invalid");
  const fetchImpl = input.fetchImpl ?? fetch;
  let mediaUrl = "";
  if (message.mediaAssetId) {
    const asset = await input.store.getSocialMediaAsset(message.mediaAssetId, input.workspaceId);
    if (!asset) throw new BillingError("The attached image is not in this workspace.", "invalid");
    mediaUrl = publicMediaUrl(input.appUrl, asset.token);
  }
  assertSocialRateLimit(input.workspaceId, "publish", now);
  const accessToken = await accessTokenFor({ store: input.store, row: account, platform, fetchImpl, now });
  const lockId = randomUUID();
  const claimed = await input.store.claimSocialPublish(message.id, input.workspaceId, input.widgetKey, lockId, now);
  if (!claimed) {
    const current = await input.store.getSocialMessage(message.id, input.workspaceId, input.widgetKey);
    if (current?.status === "published" || current?.platformPostId) {
      throw new BillingError("This post is already published.", "conflict");
    }
    throw new BillingError("This post is already publishing.", "conflict");
  }
  try {
    const result = await publishToSocialPlatform({
      platform,
      accessToken,
      destinationId: account.externalAccountId,
      text: message.draftBody,
      mediaUrl: mediaUrl || undefined,
      fetchImpl,
    });
    if (!result.platformPostId) {
      throw new BillingError("The platform did not confirm a post id.", "invalid");
    }
    const saved = await input.store.finishSocialPublish(message.id, input.workspaceId, input.widgetKey, lockId, {
      platformPostId: result.platformPostId,
      destinationId: account.externalAccountId,
      destinationName: account.accountName,
      publishMeta: JSON.stringify({ httpStatus: result.httpStatus }),
      postedAt: now,
    });
    if (!saved) {
      throw new BillingError(
        "The platform accepted the post, but the result could not be saved. Check the account before trying again.",
        "conflict",
      );
    }
    return saved;
  } catch (error) {
    const reason = error instanceof BillingError ? error.message : "The platform did not publish this post.";
    if (!(error instanceof BillingError) || error.code !== "conflict") {
      await input.store.failSocialPublish(message.id, input.workspaceId, input.widgetKey, lockId, reason);
    }
    console.error("social_publish_failed", platform);
    if (error instanceof BillingError) throw error;
    throw new BillingError(reason, "invalid");
  }
}
