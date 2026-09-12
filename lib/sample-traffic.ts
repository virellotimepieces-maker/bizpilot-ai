import { nid } from "./id";
import { draftEmailFromInbound } from "./email-draft";
import { draftSocialFromInbound } from "./social";
import type {
  BusinessPreset,
  ChatSession,
  EmailMessage,
  KnowledgeBase,
  SocialMessage,
} from "./types";

export { rebuildEmailDraft } from "./email-draft";

export function buildInboxFromPreset(
  preset: BusinessPreset,
  knowledge: KnowledgeBase,
): EmailMessage[] {
  return preset.sampleEmails.map((sample) => ({
    id: nid("mail"),
    ...draftEmailFromInbound({
      kb: knowledge,
      fromName: sample.fromName,
      fromEmail: sample.fromEmail,
      subject: sample.subject,
      body: sample.body,
      receivedAt: sample.receivedAt,
    }),
  }));
}

export function buildSocialInboxFromPreset(
  preset: BusinessPreset,
  knowledge: KnowledgeBase,
): SocialMessage[] {
  return preset.sampleSocials.map((sample) => ({
    id: nid("soc"),
    ...draftSocialFromInbound({
      kb: knowledge,
      platform: sample.platform,
      fromName: sample.fromName,
      handle: sample.handle,
      body: sample.body,
      conversationUrl: sample.conversationUrl,
      receivedAt: sample.receivedAt,
    }),
  }));
}

export function emptyChat(visitorName = "Website visitor"): ChatSession {
  return {
    id: nid("chat"),
    visitorName,
    startedAt: new Date().toISOString(),
    messages: [],
    waitingOnHuman: false,
  };
}
