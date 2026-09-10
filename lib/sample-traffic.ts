import { nid } from "./id";
import { emailSubjectFor, generateReply } from "./reply-engine";
import type {
  BusinessPreset,
  ChatSession,
  EmailMessage,
  KnowledgeBase,
} from "./types";

export function buildInboxFromPreset(
  preset: BusinessPreset,
  knowledge: KnowledgeBase,
): EmailMessage[] {
  return preset.sampleEmails.map((sample) => {
    const reply = generateReply({
      query: `${sample.subject}\n${sample.body}`,
      kb: knowledge,
      channel: "email",
      customerName: sample.fromName,
    });
    const needsCarefulReview =
      reply.requiresHuman &&
      (reply.intent === "emergency" ||
        reply.intent === "legal" ||
        reply.intent === "complaint" ||
        reply.intent === "medical_advice" ||
        reply.usedInternalKnowledge);
    return {
      id: nid("mail"),
      fromName: sample.fromName,
      fromEmail: sample.fromEmail,
      subject: sample.subject,
      body: sample.body,
      receivedAt: sample.receivedAt,
      status: needsCarefulReview ? "escalated" : "draft_ready",
      draftSubject: emailSubjectFor(sample.subject, knowledge),
      draftBody: reply.body,
      intent: reply.intent,
      sources: reply.sources,
      operatorNote: reply.operatorNote,
      usedInternalKnowledge: reply.usedInternalKnowledge,
    };
  });
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

export function rebuildEmailDraft(email: EmailMessage, knowledge: KnowledgeBase): EmailMessage {
  const reply = generateReply({
    query: `${email.subject}\n${email.body}`,
    kb: knowledge,
    channel: "email",
    customerName: email.fromName,
  });
  const needsCarefulReview =
    reply.intent === "emergency" ||
    reply.intent === "legal" ||
    reply.intent === "complaint" ||
    reply.intent === "medical_advice" ||
    reply.usedInternalKnowledge;
  return {
    ...email,
    status: email.status === "sent" || email.status === "discarded" ? email.status : needsCarefulReview ? "escalated" : "draft_ready",
    draftSubject: emailSubjectFor(email.subject, knowledge),
    draftBody: reply.body,
    intent: reply.intent,
    sources: reply.sources,
    operatorNote: reply.operatorNote,
    usedInternalKnowledge: reply.usedInternalKnowledge,
  };
}
