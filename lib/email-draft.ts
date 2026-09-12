import {
  EMAIL_AI_HELPER_COPY,
  isPaymentMethodQuestion,
  type EmailConversationKind,
} from "./ai/email-identity";
import { finalizeEmailReply, generateEmailDraft, type ChatComplete } from "./ai/generate-email-reply";
import type { EmailOrderContext } from "./ai/email-reply-prompt";
import { BillingError } from "./billing/types";
import { customerEmailQuery, emailSubjectFor, generateReply } from "./reply-engine";
import type { EmailMessage, EmailStatus, GeneratedReply, KnowledgeBase, ReplyIntent } from "./types";

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

export function emailIntentFromKind(kind: EmailConversationKind, query: string): ReplyIntent {
  if (isPaymentMethodQuestion(query)) return "store_payment";
  if (kind === "order") return "account_specific";
  if (kind === "complaint") return "complaint";
  if (kind === "appointment") return "appointments";
  if (kind === "quote") return "pricing";
  if (kind === "suspicious") return "legal";
  return "unknown";
}

function aiEmailMessage(
  input: {
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt?: string;
    kb: KnowledgeBase;
  },
  draft: { body: string; operatorNote: string; kind: EmailConversationKind },
): Omit<EmailMessage, "id"> {
  const query = `${input.subject}\n${input.body}`;
  return {
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    subject: input.subject,
    body: input.body,
    receivedAt: input.receivedAt ?? "Just now",
    status: "draft_ready",
    draftSubject: emailSubjectFor(input.subject, input.kb),
    draftBody: draft.body,
    intent: emailIntentFromKind(draft.kind, query),
    sources: [],
    operatorNote: draft.operatorNote,
    usedInternalKnowledge: false,
  };
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
    query: customerEmailQuery(input.subject, input.body),
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

export async function draftEmailFromInboundAi(
  input: {
    kb: KnowledgeBase;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt?: string;
  },
  options: { complete?: ChatComplete; orderData?: EmailOrderContext | null; workspaceId?: string } = {},
): Promise<Omit<EmailMessage, "id">> {
  try {
    const draft = await generateEmailDraft({
      knowledge: input.kb,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      subject: input.subject,
      body: input.body,
      orderData: options.orderData ?? null,
      complete: options.complete,
      workspaceId: options.workspaceId,
    });
    return aiEmailMessage(input, draft);
  } catch (error) {
    if (error instanceof BillingError && error.code === "limit") throw error;
    return aiEmailMessage(input, {
      body: finalizeEmailReply("", {
        knowledge: input.kb,
        fromName: input.fromName,
        subject: input.subject,
        body: input.body,
        orderData: options.orderData ?? null,
      }),
      operatorNote: `${EMAIL_AI_HELPER_COPY} The AI draft could not be generated. Press Regenerate reply to try again. Nothing was sent.`,
      kind: "general",
    });
  }
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

export async function rebuildEmailDraftAi(
  email: EmailMessage,
  knowledge: KnowledgeBase,
  options: { complete?: ChatComplete; orderData?: EmailOrderContext | null; workspaceId?: string } = {},
): Promise<EmailMessage> {
  const locked = email.status === "sent" || email.status === "discarded";
  if (locked) return email;
  const next = await draftEmailFromInboundAi(
    {
      kb: knowledge,
      fromName: email.fromName,
      fromEmail: email.fromEmail,
      subject: email.subject,
      body: email.body,
      receivedAt: email.receivedAt,
    },
    options,
  );
  return { ...email, ...next, sentAt: email.sentAt };
}
