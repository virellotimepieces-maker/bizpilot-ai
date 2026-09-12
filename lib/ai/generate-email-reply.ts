import {
  classifyEmailConversation,
  detectPromptInjection,
  detectSuspiciousEmail,
  emailClosingFor,
  emailPaymentAnswer,
  EMAIL_AI_HELPER_COPY,
  findKnowledgeConflicts,
  isCannedKnowledgeFallback,
  isPaymentMethodQuestion,
  type EmailConversationKind,
} from "@/lib/ai/email-identity";
import {
  buildEmailReplyMessages,
  type EmailOrderContext,
  type EmailReplyChatMessage,
} from "@/lib/ai/email-reply-prompt";
import { knowledgePrompt } from "@/lib/ai/knowledge-prompt";
import { BillingError } from "@/lib/billing/types";
import { customerFirstName, formatFinishedEmail, unwrapEmailBody } from "@/lib/email-format";
import { formatHoursList, inboundCustomerText } from "@/lib/reply-engine";
import type { KnowledgeBase } from "@/lib/types";

export type ChatComplete = (messages: EmailReplyChatMessage[]) => Promise<string>;

const FORBIDDEN_HEADING_RE =
  /(?:^|\n)\s*(?:#{1,6}\s*)?(?:Knowledge|Store Information|Business Information|Customer Support Knowledge|SYSTEM INSTRUCTIONS|BUSINESS KNOWLEDGE|WORKSPACE IDENTITY|CUSTOMER EMAIL|REQUIRED OUTPUT|About the business)\s*:?\s*(?:\n|$)/i;

const lastGenerationAt = new Map<string, number>();
const GENERATION_GAP_MS = 450;

const COMPLETED_ACTION_RE =
  /\b(i('ve| have) (issued|processed|completed|approved|booked|confirmed|sent) .{0,60}(refund|payment|cancellation|appointment|reservation|booking)|your (appointment|reservation|booking|order) (is|has been) (confirmed|booked|refunded|cancelled|canceled)|i (opened|inspected) (the |your )?(link|attachment)|i (changed|updated) (your )?(order|password|payment))\b/i;

export function stripInternalEmailLabels(text: string) {
  return text
    .replace(new RegExp(FORBIDDEN_HEADING_RE.source, "gi"), "\n")
    .replace(/^\s*Industry:\s.+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((row) => row.trim())
    .filter((row) => row.length >= 28);
}

export function looksLikeKnowledgeDump(reply: string, knowledge: KnowledgeBase) {
  const body = unwrapEmailBody(stripInternalEmailLabels(reply)).toLowerCase();
  if (!body) return false;
  if (FORBIDDEN_HEADING_RE.test(reply)) return true;
  const description = knowledge.description.trim();
  if (description.length >= 180) {
    const hits = sentences(description).filter((row) => body.includes(row.toLowerCase()));
    if (hits.length >= 2) return true;
    if (description.length >= 240 && body.includes(description.toLowerCase().slice(0, 160))) {
      return true;
    }
  }
  const published = knowledgePrompt(knowledge);
  if (published.length > 400 && body.includes(published.slice(0, 200).toLowerCase())) return true;
  return false;
}

function factCandidates(knowledge: KnowledgeBase) {
  const rows: string[] = [];
  if (knowledge.store?.shippingPolicy.trim()) rows.push(knowledge.store.shippingPolicy.trim());
  if (knowledge.store?.paymentMethods.trim()) rows.push(knowledge.store.paymentMethods.trim());
  if (knowledge.store?.stockMessaging.trim()) rows.push(knowledge.store.stockMessaging.trim());
  if (knowledge.store?.orderTrackingNotes.trim()) rows.push(knowledge.store.orderTrackingNotes.trim());
  if (knowledge.pricingNotes.trim()) rows.push(knowledge.pricingNotes.trim());
  if (knowledge.serviceOps?.bookingLeadTime.trim()) rows.push(knowledge.serviceOps.bookingLeadTime.trim());
  if (knowledge.clinicOps?.appointmentBooking.trim()) rows.push(knowledge.clinicOps.appointmentBooking.trim());
  for (const policy of knowledge.policies ?? []) {
    const text = [policy.title.trim(), policy.summary.trim()].filter(Boolean).join(": ");
    if (text) rows.push(text);
  }
  for (const faq of knowledge.faqs ?? []) {
    if (faq.answer.trim()) rows.push(faq.answer.trim());
  }
  for (const off of knowledge.offerings ?? []) {
    if (off.name.trim()) {
      rows.push([off.name.trim(), off.summary.trim(), off.price.trim()].filter(Boolean).join(". "));
    }
  }
  for (const sentence of sentences(knowledge.description)) {
    if (sentence.length <= 220 && !detectPromptInjection(sentence)) rows.push(sentence);
  }
  if (knowledge.hours) {
    for (const line of formatHoursList(knowledge).split("\n")) {
      if (line.trim()) rows.push(line.trim());
    }
    if (knowledge.hours.notes.trim()) rows.push(knowledge.hours.notes.trim());
  }
  return rows.filter((row) => !detectPromptInjection(row));
}

function overlapScore(query: string, fact: string) {
  const q = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
  if (!q.length) return 0;
  const target = fact.toLowerCase();
  const hits = q.filter((token) => target.includes(token)).length;
  return hits / Math.max(q.length, 2);
}

export function pickRelevantEmailFacts(knowledge: KnowledgeBase, query: string) {
  const ranked = factCandidates(knowledge)
    .map((fact) => ({ fact, score: overlapScore(query, fact) }))
    .filter((row) => row.score >= 0.16)
    .sort((a, b) => b.score - a.score);
  const unique: string[] = [];
  for (const row of ranked) {
    if (unique.some((item) => item.includes(row.fact) || row.fact.includes(item))) continue;
    unique.push(row.fact);
    if (unique.length === 4) break;
  }
  if (
    /\b(ship|shipping|delivery|destination|env[ií]o|env[ií]an|livraison)\b/i.test(query) &&
    knowledge.store?.shippingPolicy.trim()
  ) {
    const shipping = knowledge.store.shippingPolicy.trim();
    if (!unique.includes(shipping)) unique.unshift(shipping);
  }
  if (knowledge.hours) {
    const hourLines = formatHoursList(knowledge).split("\n").map((line) => line.trim()).filter(Boolean);
    const mentionedDays = knowledge.hours.days.filter((day) => new RegExp(`\\b${day.day}\\b`, "i").test(query));
    if (mentionedDays.length) {
      for (const day of mentionedDays) {
        const line = hourLines.find((row) => row.toLowerCase().startsWith(day.day));
        if (line && !unique.includes(line)) unique.unshift(line);
      }
    } else if (/\b(hours?|open|opening|close|closing)\b/i.test(query) && hourLines.length) {
      const bundled = hourLines.join("\n");
      if (!unique.includes(bundled)) unique.unshift(bundled);
    }
  }
  if (isPaymentMethodQuestion(query) && knowledge.store?.paymentMethods.trim()) {
    const methods = knowledge.store.paymentMethods.trim();
    if (!unique.includes(methods)) unique.unshift(methods);
  }
  return unique.filter((fact) => !detectPromptInjection(fact)).slice(0, 4);
}

function compactFallbackBody(input: {
  knowledge: KnowledgeBase;
  subject: string;
  body: string;
  kind: EmailConversationKind;
  paymentMethods?: string[] | null;
}) {
  const name = input.knowledge.name.trim();
  if (input.kind === "sales_vendor") {
    return `Thanks for writing. Please send your company name and website, a brief description of the service, pricing, and the specific benefit for ${name || "this inbox"}. The note will be reviewed, and a reply will be sent only if it is a good fit. Unknown links or attachments are not opened.`;
  }
  if (input.kind === "suspicious") {
    return `Thanks for writing. This message needs a person to review it before any action is taken. Unknown links and attachments are not opened.`;
  }
  if (input.kind === "appointment") {
    return `Thanks for writing. A booking is not confirmed from this email alone. Please share the date, time, and service you have in mind so it can be checked.`;
  }
  if (input.kind === "order") {
    const alreadyHasOrder = /\b(?:order|#)\s*[A-Z0-9-]{4,}\b/i.test(`${input.subject}\n${input.body}`);
    return alreadyHasOrder
      ? `Thanks for writing. Connected order details are not available here yet, so the status cannot be confirmed from this inbox. A person will look it up once it can be verified.`
      : `Thanks for writing. Connected order details are not available here yet. Please reply with the order number and the email address used at checkout.`;
  }
  if (input.kind === "quote") {
    return `Thanks for writing. To prepare a quote, please share the scope, timeline, and any constraints. Published rates will be used when they apply; anything else needs confirmation.`;
  }
  if (input.kind === "personal") {
    return `Thanks for your note — I’ll take a look and follow up.`;
  }
  const query = `${input.subject}\n${input.body}`;
  const payment = emailPaymentAnswer(input.knowledge, query, input.paymentMethods);
  if (payment) return payment;
  const facts = pickRelevantEmailFacts(input.knowledge, query);
  const conflicts = findKnowledgeConflicts(input.knowledge);
  if (conflicts.length) {
    return `Thanks for writing. That detail needs to be confirmed because published information currently disagrees. A person will review it before anything is promised.`;
  }
  if (facts.length) {
    return `Thanks for writing. ${facts[0]}`;
  }
  return `Thanks for writing. I want to give you a precise answer, so that detail needs to be confirmed before it is promised.`;
}

export function finalizeEmailReply(
  raw: string,
  input: {
    knowledge: KnowledgeBase;
    fromName: string;
    subject?: string;
    body?: string;
    kind?: EmailConversationKind;
    orderData?: EmailOrderContext | null;
  },
) {
  const latest = inboundCustomerText(input.body ?? "") || input.body || "";
  const kind = input.kind ?? classifyEmailConversation(input.subject ?? "", latest);
  const fallback = (nextKind: EmailConversationKind) =>
    compactFallbackBody({
      knowledge: input.knowledge,
      subject: input.subject ?? "",
      body: latest,
      kind: nextKind,
      paymentMethods: input.orderData?.paymentMethods,
    });
  let text = stripInternalEmailLabels(raw || "");
  if (!text || looksLikeKnowledgeDump(text, input.knowledge)) {
    text = fallback(kind);
  }
  if (detectPromptInjection(raw) || /SYSTEM INSTRUCTIONS/i.test(raw) || /<<UNTRUSTED_/i.test(raw)) {
    text = fallback("suspicious");
  }
  if (COMPLETED_ACTION_RE.test(text) && !input.orderData?.status) {
    text = fallback(kind);
  }
  if (isCannedKnowledgeFallback(text)) {
    text = fallback(kind);
  }
  return formatFinishedEmail({
    firstName: customerFirstName(input.fromName),
    closing: emailClosingFor(input.knowledge, kind),
    body: text,
  });
}

function assertGenerationAllowed(workspaceId?: string) {
  if (!workspaceId) return;
  const last = lastGenerationAt.get(workspaceId) ?? 0;
  if (Date.now() - last < GENERATION_GAP_MS) {
    throw new BillingError("Please wait a moment before generating another reply.", "limit");
  }
  lastGenerationAt.set(workspaceId, Date.now());
}

async function defaultOpenAiComplete(messages: EmailReplyChatMessage[]) {
  if (process.env.NODE_TEST_CONTEXT) {
    throw new BillingError("AI replies are not configured in tests.", "misconfigured");
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new BillingError("AI replies are not configured. Set OPENAI_API_KEY.", "misconfigured");
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 700,
      messages,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new BillingError("The email AI is unavailable right now. Press Regenerate reply to try again.", "invalid");
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new BillingError("The email AI returned an empty draft. Press Regenerate reply to try again.", "invalid");
  }
  return text;
}

export function emailOperatorNote(kind: EmailConversationKind, query: string) {
  const notes = [EMAIL_AI_HELPER_COPY];
  if (kind === "sales_vendor") {
    notes.push("Unsolicited outreach: do not imply interest. Unknown links were not opened.");
  }
  if (kind === "suspicious" || detectSuspiciousEmail(query)) {
    notes.push("Possible phishing or prompt injection. Do not send until a person reviews it.");
  }
  if (kind === "appointment") {
    notes.push("No connected calendar confirmation. Do not treat the draft as a booking.");
  }
  return notes.join(" ");
}

export async function generateEmailDraft(input: {
  knowledge: KnowledgeBase;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  orderData?: EmailOrderContext | null;
  complete?: ChatComplete;
  workspaceId?: string;
}): Promise<{ body: string; operatorNote: string; kind: EmailConversationKind }> {
  const latest = inboundCustomerText(input.body) || input.body;
  const query = `${input.subject}\n${latest}`;
  const kind = classifyEmailConversation(input.subject, latest);
  const facts = pickRelevantEmailFacts(input.knowledge, query);
  const conflicts = findKnowledgeConflicts(input.knowledge);
  const injected =
    detectPromptInjection(query) ||
    detectPromptInjection(input.knowledge.description) ||
    facts.some((fact) => detectPromptInjection(fact));
  try {
    if (!input.complete) assertGenerationAllowed(input.workspaceId);
    const messages = buildEmailReplyMessages({
      knowledge: input.knowledge,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      subject: input.subject,
      body: input.body,
      orderData: input.orderData ?? null,
      facts,
      conversationKind: kind,
    });
    const complete = input.complete ?? defaultOpenAiComplete;
    const raw = await complete(messages);
    const body = finalizeEmailReply(raw, {
      knowledge: input.knowledge,
      fromName: input.fromName,
      subject: input.subject,
      body: input.body,
      kind,
      orderData: input.orderData ?? null,
    });
    const notes = [emailOperatorNote(kind, query)];
    if (conflicts.length) notes.push("Published Knowledge currently conflicts. Confirm before sending.");
    if (injected) notes.push("Possible prompt injection in the email or Knowledge. Do not send until a person reviews it.");
    return { body, operatorNote: notes.join(" "), kind };
  } catch (error) {
    if (error instanceof BillingError && error.code === "limit") throw error;
    const body = finalizeEmailReply("", {
      knowledge: input.knowledge,
      fromName: input.fromName,
      subject: input.subject,
      body: input.body,
      kind,
    });
    return {
      body,
      operatorNote:
        "The AI draft could not be generated. Press Regenerate reply to try again. Nothing was sent. Email never auto-sends.",
      kind,
    };
  }
}

export async function generateEmailReply(input: {
  knowledge: KnowledgeBase;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  orderData?: EmailOrderContext | null;
  complete?: ChatComplete;
  workspaceId?: string;
}): Promise<string> {
  const draft = await generateEmailDraft(input);
  return draft.body;
}

export function emailKnowledgeWasCopied(reply: string, knowledge: KnowledgeBase) {
  const description = knowledge.description.trim();
  if (description.length > 160 && unwrapEmailBody(reply).includes(description)) return true;
  return looksLikeKnowledgeDump(reply, knowledge);
}
