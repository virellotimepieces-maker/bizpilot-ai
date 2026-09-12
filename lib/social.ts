import {
  generateSocialDraft,
  composeSocialDraft,
  socialIntentFromQuery,
  collectSocialSources,
  pickRelevantSocialFacts,
  usedInternalSocialKnowledge,
  type SocialChatComplete,
  type SocialDraftInput,
} from "@/lib/ai/generate-social-draft";
import type {
  SocialHashtagMode,
  SocialMode,
  SocialPostGoal,
  SocialTone,
} from "@/lib/ai/social-prompt";
import type {
  KnowledgeBase,
  SocialMessage,
  SocialPlatform,
  SocialStatus,
} from "./types";

export type { SocialHashtagMode, SocialMode, SocialPostGoal, SocialTone };

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

export const SOCIAL_MODES: SocialMode[] = ["reply", "post"];

export const SOCIAL_MODE_LABEL: Record<SocialMode, string> = {
  reply: "Reply to message",
  post: "Create post",
};

export const SOCIAL_TONES: SocialTone[] = [
  "professional",
  "friendly",
  "casual",
  "confident",
  "promotional",
  "educational",
];

export const SOCIAL_TONE_LABEL: Record<SocialTone, string> = {
  professional: "Professional",
  friendly: "Friendly",
  casual: "Casual",
  confident: "Confident",
  promotional: "Promotional",
  educational: "Educational",
};

export const SOCIAL_GOALS: SocialPostGoal[] = [
  "awareness",
  "engagement",
  "traffic",
  "leads",
  "sales",
  "announcement",
];

export const SOCIAL_GOAL_LABEL: Record<SocialPostGoal, string> = {
  awareness: "Awareness",
  engagement: "Engagement",
  traffic: "Traffic",
  leads: "Leads",
  sales: "Sales",
  announcement: "Announcement",
};

export const SOCIAL_HASHTAG_MODES: SocialHashtagMode[] = ["none", "suggested", "custom"];

export const SOCIAL_HASHTAG_LABEL: Record<SocialHashtagMode, string> = {
  none: "None",
  suggested: "Suggested",
  custom: "Custom",
};

export const SOCIAL_NEVER_POST =
  "Social replies stay drafts — copy and post them yourself. BizPilot never posts to Instagram, Facebook, TikTok, or Messenger.";

export const SOCIAL_AI_HELPER_COPY =
  "AI creates a relevant social reply or post using your instructions and Knowledge as context. Review and edit the draft before copying. BizPilot never posts automatically.";

export const SOCIAL_CUSTOMER_FIELD_LABEL = "Customer name or username (optional)";

const META_PREFIX = "bp1.";

export type SocialDraftMeta = {
  mode: SocialMode;
  tone: SocialTone;
  goal?: SocialPostGoal;
  hashtags: SocialHashtagMode;
  customHashtags?: string;
  cta?: string;
  link?: string;
  language?: string;
  displayHandle: string;
};

export type SocialComposeInput = {
  kb: KnowledgeBase;
  platform: SocialPlatform;
  body: string;
  fromName?: string;
  handle?: string;
  conversationUrl?: string;
  receivedAt?: string;
  mode?: SocialMode;
  tone?: SocialTone;
  goal?: SocialPostGoal;
  hashtags?: SocialHashtagMode;
  customHashtags?: string;
  cta?: string;
  link?: string;
  language?: string;
};

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

export function isSocialMode(value: string): value is SocialMode {
  return value === "reply" || value === "post";
}

export function isSocialTone(value: string): value is SocialTone {
  return (SOCIAL_TONES as readonly string[]).includes(value);
}

export function isSocialGoal(value: string): value is SocialPostGoal {
  return (SOCIAL_GOALS as readonly string[]).includes(value);
}

export function isSocialHashtagMode(value: string): value is SocialHashtagMode {
  return (SOCIAL_HASHTAG_MODES as readonly string[]).includes(value);
}

export function packSocialHandle(displayHandle: string, meta: Omit<SocialDraftMeta, "displayHandle">) {
  const payload: SocialDraftMeta = { ...meta, displayHandle };
  return `${META_PREFIX}${encodeURIComponent(JSON.stringify(payload))}`;
}

export function readSocialDraftMeta(handle: string): SocialDraftMeta {
  if (!handle.startsWith(META_PREFIX)) {
    return {
      mode: "reply",
      tone: "friendly",
      hashtags: "none",
      displayHandle: handle,
    };
  }
  try {
    const parsed = JSON.parse(decodeURIComponent(handle.slice(META_PREFIX.length))) as SocialDraftMeta;
    return {
      mode: parsed.mode === "post" ? "post" : "reply",
      tone: isSocialTone(parsed.tone) ? parsed.tone : "friendly",
      goal: parsed.goal && isSocialGoal(parsed.goal) ? parsed.goal : undefined,
      hashtags: isSocialHashtagMode(parsed.hashtags) ? parsed.hashtags : "none",
      customHashtags: parsed.customHashtags,
      cta: parsed.cta,
      link: parsed.link,
      language: parsed.language,
      displayHandle: parsed.displayHandle || "",
    };
  } catch {
    return {
      mode: "reply",
      tone: "friendly",
      hashtags: "none",
      displayHandle: handle,
    };
  }
}

export function socialNeedsCarefulReview(intent: SocialMessage["intent"], usedInternalKnowledge: boolean) {
  return (
    intent === "emergency" ||
    intent === "legal" ||
    intent === "complaint" ||
    intent === "medical_advice" ||
    usedInternalKnowledge
  );
}

function toDraftInput(input: SocialComposeInput): SocialDraftInput {
  const mode = input.mode ?? "reply";
  return {
    knowledge: input.kb,
    platform: input.platform,
    mode,
    body: input.body,
    fromName: input.fromName,
    tone: input.tone ?? "friendly",
    goal: input.goal,
    hashtags: input.hashtags ?? "none",
    customHashtags: input.customHashtags,
    cta: input.cta,
    link: input.link || input.conversationUrl,
    language: input.language,
  };
}

function displayFromName(input: SocialComposeInput, mode: SocialMode) {
  const name = input.fromName?.trim();
  if (name) return name;
  if (mode === "post") return "New post";
  return "Customer";
}

function displayHandle(input: SocialComposeInput) {
  const handle = input.handle?.trim();
  if (handle) return handle;
  const name = input.fromName?.trim();
  if (name?.startsWith("@")) return name;
  return name || "";
}

function buildSocialMessage(
  input: SocialComposeInput,
  generated: {
    body: string;
    operatorNote: string;
    intent: SocialMessage["intent"];
    sources: SocialMessage["sources"];
    usedInternalKnowledge: boolean;
  },
): Omit<SocialMessage, "id"> {
  const mode = input.mode ?? "reply";
  const tone = input.tone ?? "friendly";
  const hashtags = input.hashtags ?? "none";
  const fromName = displayFromName(input, mode);
  const handle = packSocialHandle(displayHandle(input), {
    mode,
    tone,
    goal: input.goal,
    hashtags,
    customHashtags: input.customHashtags,
    cta: input.cta,
    link: input.link,
    language: input.language,
  });
  const status = socialNeedsCarefulReview(generated.intent, generated.usedInternalKnowledge)
    ? "escalated"
    : "draft_ready";
  return {
    platform: input.platform,
    fromName,
    handle,
    body: input.body,
    receivedAt: input.receivedAt ?? "Just now",
    conversationUrl: input.conversationUrl || input.link,
    status,
    draftBody: generated.body,
    intent: generated.intent,
    sources: generated.sources,
    operatorNote: generated.operatorNote,
    usedInternalKnowledge: generated.usedInternalKnowledge,
  };
}

export function draftSocialFromInbound(input: SocialComposeInput): Omit<SocialMessage, "id"> {
  const draftInput = toDraftInput(input);
  const body = composeSocialDraft(draftInput);
  const facts = pickRelevantSocialFacts(input.kb, input.body);
  const intent = socialIntentFromQuery(input.body, input.mode ?? "reply");
  const usedInternalKnowledge = usedInternalSocialKnowledge(input.kb, input.body);
  return buildSocialMessage(input, {
    body,
    operatorNote: SOCIAL_AI_HELPER_COPY,
    intent,
    sources: collectSocialSources(input.kb, facts),
    usedInternalKnowledge,
  });
}

export async function draftSocialFromInboundAi(
  input: SocialComposeInput & { complete?: SocialChatComplete; workspaceId?: string },
): Promise<Omit<SocialMessage, "id">> {
  const generated = await generateSocialDraft({
    ...toDraftInput(input),
    complete: input.complete,
    workspaceId: input.workspaceId,
  });
  return buildSocialMessage(input, generated);
}

export function rebuildSocialDraft(message: SocialMessage, kb: KnowledgeBase): SocialMessage {
  const locked = message.status === "posted" || message.status === "discarded";
  if (locked) return message;
  const meta = readSocialDraftMeta(message.handle);
  const next = draftSocialFromInbound({
    kb,
    platform: message.platform,
    fromName: message.fromName,
    handle: meta.displayHandle,
    body: message.body,
    conversationUrl: message.conversationUrl || meta.link,
    receivedAt: message.receivedAt,
    mode: meta.mode,
    tone: meta.tone,
    goal: meta.goal,
    hashtags: meta.hashtags,
    customHashtags: meta.customHashtags,
    cta: meta.cta,
    link: meta.link,
    language: meta.language,
  });
  return {
    ...message,
    ...next,
    postedAt: message.postedAt,
  };
}

export async function rebuildSocialDraftAi(
  message: SocialMessage,
  kb: KnowledgeBase,
  options?: { complete?: SocialChatComplete; workspaceId?: string },
): Promise<SocialMessage> {
  const locked = message.status === "posted" || message.status === "discarded";
  if (locked) return message;
  const meta = readSocialDraftMeta(message.handle);
  const next = await draftSocialFromInboundAi({
    kb,
    platform: message.platform,
    fromName: message.fromName,
    handle: meta.displayHandle,
    body: message.body,
    conversationUrl: message.conversationUrl || meta.link,
    receivedAt: message.receivedAt,
    mode: meta.mode,
    tone: meta.tone,
    goal: meta.goal,
    hashtags: meta.hashtags,
    customHashtags: meta.customHashtags,
    cta: meta.cta,
    link: meta.link,
    language: meta.language,
    complete: options?.complete,
    workspaceId: options?.workspaceId,
  });
  return {
    ...message,
    ...next,
    postedAt: message.postedAt,
  };
}

export function socialListTitle(message: Pick<SocialMessage, "fromName" | "handle" | "body">) {
  const meta = readSocialDraftMeta(message.handle);
  if (meta.mode === "post") {
    return message.body.split("\n").map((row) => row.trim()).find(Boolean) || "New post";
  }
  return message.fromName || meta.displayHandle || "Customer";
}

export function socialListSubtitle(message: Pick<SocialMessage, "platform" | "handle">) {
  const meta = readSocialDraftMeta(message.handle);
  const platform = SOCIAL_PLATFORM_LABEL[message.platform];
  if (meta.mode === "post") return `${platform} · Create post`;
  return meta.displayHandle ? `${platform} · ${meta.displayHandle}` : platform;
}
