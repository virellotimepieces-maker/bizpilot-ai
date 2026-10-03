import type { PublicSocialAccount } from "./public";

export type SocialPublishDecision = {
  ok: boolean;
  reason: string;
};

export function evaluateSocialPublish(input: {
  status: string;
  subscriptionActive: boolean;
  hasMedia: boolean;
  account: PublicSocialAccount | null;
}): SocialPublishDecision {
  if (!input.subscriptionActive) {
    return {
      ok: false,
      reason: "An active BizPilot subscription is required before publishing. Drafts and history are kept.",
    };
  }
  if (input.status === "published") {
    return { ok: false, reason: "This post is already published." };
  }
  if (input.status === "publishing") {
    return { ok: false, reason: "This post is already publishing." };
  }
  if (input.status !== "approved" && input.status !== "failed") {
    return { ok: false, reason: "Approve the draft before publishing." };
  }
  const account = input.account;
  if (!account || !account.configured || account.connection === "setup_required") {
    const missing = account?.missing.length ? ` Missing: ${account.missing.join(", ")}.` : "";
    return {
      ok: false,
      reason: `Setup required for ${account?.label ?? "this platform"}.${missing} Copy is still available.`,
    };
  }
  if (account.connection === "needs_reconnect") {
    return { ok: false, reason: `Reconnect ${account.label}. The saved authorization expired.` };
  }
  if (account.connection === "pending_selection") {
    return { ok: false, reason: `Choose the ${account.label} destination before publishing.` };
  }
  if (account.connection !== "connected") {
    return {
      ok: false,
      reason: `Connect ${account.label} before publishing. Nothing is posted automatically.`,
    };
  }
  if (!account.hasPermission) {
    return {
      ok: false,
      reason: `The ${account.label} connection is missing the ${account.requiredPermission} permission.`,
    };
  }
  if (account.media === "required" && !input.hasMedia) {
    return { ok: false, reason: `${account.label} requires an image before publishing.` };
  }
  if (account.media === "unsupported" && input.hasMedia) {
    return {
      ok: false,
      reason: `Remove the image. ${account.label} image posts are not available yet.`,
    };
  }
  return { ok: true, reason: "" };
}
