import { emailSubjectFor, generateReply } from "./reply-engine";
import type { EmailMessage, EmailStatus, GeneratedReply, KnowledgeBase } from "./types";

export const EMAIL_STATUS_LABEL: Record<EmailStatus, string> = {
  draft_ready: "Draft ready",
  needs_review: "Needs review",
  escalated: "Escalated",
  sent: "Sent by you",
  discarded: "Discarded",
};

export function emailNeedsCarefulReview(reply: GeneratedReply) {
  return (
    reply.intent === "emergency" ||
    reply.intent === "legal" ||
    reply.intent === "complaint" ||
    reply.intent === "medical_advice" ||
    reply.usedInternalKnowledge
  );
}

export function isEmailStatus(value: string): value is EmailMessage["status"] {
  return (
    value === "draft_ready" ||
    value === "needs_review" ||
    value === "escalated" ||
    value === "sent" ||
    value === "discarded"
  );
}

export function draftEmailFromInbound(input: {
  kb: KnowledgeBase;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt?: string;
}): Omit<EmailMessage, "id"> {
  const reply = generateReply({
    query: `${input.subject}\n${input.body}`,
    kb: input.kb,
    channel: "email",
    customerName: input.fromName,
  });
  return {
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    subject: input.subject,
    body: input.body,
    receivedAt: input.receivedAt ?? "Just now",
    status: emailNeedsCarefulReview(reply) ? "escalated" : "draft_ready",
    draftSubject: emailSubjectFor(input.subject, input.kb),
    draftBody: reply.body,
    intent: reply.intent,
    sources: reply.sources,
    operatorNote: reply.operatorNote,
    usedInternalKnowledge: reply.usedInternalKnowledge,
  };
}

export function rebuildEmailDraft(email: EmailMessage, knowledge: KnowledgeBase): EmailMessage {
  const locked = email.status === "sent" || email.status === "discarded";
  if (locked) return email;
  const next = draftEmailFromInbound({
    kb: knowledge,
    fromName: email.fromName,
    fromEmail: email.fromEmail,
    subject: email.subject,
    body: email.body,
    receivedAt: email.receivedAt,
  });
  return { ...email, ...next, sentAt: email.sentAt };
}
