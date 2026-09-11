import { generateReply } from "./reply-engine";
import type {
  GeneratedReply,
  KnowledgeBase,
  SocialMessage,
  SocialPlatform,
  SocialStatus,
} from "./types";

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  "instagram",
  "facebook",
  "tiktok",
  "messenger",
];

export const SOCIAL_PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  messenger: "Messenger",
};

export const SOCIAL_STATUS_LABEL: Record<SocialStatus, string> = {
  draft_ready: "Draft ready",
  needs_review: "Needs review",
  escalated: "Escalated",
  posted: "Posted by you",
  discarded: "Discarded",
};

export const SOCIAL_NEVER_POST =
  "Social replies stay drafts — copy and post them yourself. BizPilot never posts to Instagram, Facebook, TikTok, or Messenger.";

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export function isSocialStatus(value: string): value is SocialStatus {
  return (
    value === "draft_ready" ||
    value === "needs_review" ||
    value === "escalated" ||
    value === "posted" ||
    value === "discarded"
  );
}

export function socialNeedsCarefulReview(reply: GeneratedReply) {
  return (
    reply.intent === "emergency" ||
    reply.intent === "legal" ||
    reply.intent === "complaint" ||
    reply.intent === "medical_advice" ||
    reply.usedInternalKnowledge
  );
}

export function draftSocialFromInbound(input: {
  kb: KnowledgeBase;
  platform: SocialPlatform;
  fromName: string;
  handle: string;
  body: string;
  conversationUrl?: string;
  receivedAt?: string;
}): Omit<SocialMessage, "id"> {
  const reply = generateReply({
    query: input.body,
    kb: input.kb,
    channel: "social",
    customerName: input.fromName,
  });
  return {
    platform: input.platform,
    fromName: input.fromName,
    handle: input.handle,
    body: input.body,
    receivedAt: input.receivedAt ?? "Just now",
    conversationUrl: input.conversationUrl,
    status: socialNeedsCarefulReview(reply) ? "escalated" : "draft_ready",
    draftBody: reply.body,
    intent: reply.intent,
    sources: reply.sources,
    operatorNote: reply.operatorNote,
    usedInternalKnowledge: reply.usedInternalKnowledge,
  };
}

export function rebuildSocialDraft(message: SocialMessage, kb: KnowledgeBase): SocialMessage {
  const next = draftSocialFromInbound({
    kb,
    platform: message.platform,
    fromName: message.fromName,
    handle: message.handle,
    body: message.body,
    conversationUrl: message.conversationUrl,
    receivedAt: message.receivedAt,
  });
  const locked = message.status === "posted" || message.status === "discarded";
  if (locked) return message;
  return {
    ...message,
    ...next,
    postedAt: message.postedAt,
  };
}
