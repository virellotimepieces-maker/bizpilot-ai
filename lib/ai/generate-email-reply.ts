import {
  buildEmailReplyMessages,
  type EmailOrderContext,
  type EmailReplyChatMessage,
} from "@/lib/ai/email-reply-prompt";
import { knowledgePrompt } from "@/lib/ai/knowledge-prompt";
import { BillingError } from "@/lib/billing/types";
import { customerFirstName, formatFinishedEmail, unwrapEmailBody } from "@/lib/email-format";
import type { KnowledgeBase } from "@/lib/types";

export type ChatComplete = (messages: EmailReplyChatMessage[]) => Promise<string>;

const FORBIDDEN_HEADING_RE =
  /(?:^|\n)\s*(?:#{1,6}\s*)?(?:Knowledge|Store Information|Business Information|Customer Support Knowledge|SYSTEM INSTRUCTIONS|BUSINESS KNOWLEDGE|CUSTOMER EMAIL|REQUIRED OUTPUT|About the business)\s*:?\s*(?:\n|$)/i;

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
  const markers = [knowledge.tagline.trim(), knowledge.industry.trim()].filter((row) => row.length > 8);
  if (markers.length >= 2 && markers.every((row) => body.includes(row.toLowerCase())) && description.length > 80) {
    return true;
  }
  return false;
}

function factCandidates(knowledge: KnowledgeBase) {
  const rows: string[] = [];
  if (knowledge.store?.shippingPolicy.trim()) rows.push(knowledge.store.shippingPolicy.trim());
  if (knowledge.store?.paymentMethods.trim()) rows.push(knowledge.store.paymentMethods.trim());
  if (knowledge.store?.stockMessaging.trim()) rows.push(knowledge.store.stockMessaging.trim());
  if (knowledge.store?.orderTrackingNotes.trim()) rows.push(knowledge.store.orderTrackingNotes.trim());
  if (knowledge.pricingNotes.trim()) rows.push(knowledge.pricingNotes.trim());
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
    if (sentence.length <= 220) rows.push(sentence);
  }
  return rows;
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
    if (unique.length === 2) break;
  }
  return unique;
}

function compactFallbackBody(input: {
  knowledge: KnowledgeBase;
  fromName: string;
  subject: string;
  body: string;
}) {
  const query = `${input.subject}\n${input.body}`;
  const facts = pickRelevantEmailFacts(input.knowledge, query);
  const name = input.knowledge.name.trim() || "us";
  if (facts.length) {
    return `Thank you for contacting ${name}. ${facts.join(" ")}`;
  }
  return `Thank you for writing. We need to confirm the details on our side before we can give you a specific answer. If this is about an order, please reply with the order number and the email address used at checkout.`;
}

export function finalizeEmailReply(
  raw: string,
  input: {
    knowledge: KnowledgeBase;
    fromName: string;
    subject?: string;
    body?: string;
  },
) {
  let text = stripInternalEmailLabels(raw || "");
  if (!text || looksLikeKnowledgeDump(text, input.knowledge)) {
    text = compactFallbackBody({
      knowledge: input.knowledge,
      fromName: input.fromName,
      subject: input.subject ?? "",
      body: input.body ?? "",
    });
  }
  return formatFinishedEmail({
    firstName: customerFirstName(input.fromName),
    businessName: input.knowledge.name,
    body: text,
  });
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
  });
  if (!response.ok) {
    throw new Error(`model_http_${response.status}`);
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("model_empty");
  return text;
}

export async function generateEmailReply(input: {
  knowledge: KnowledgeBase;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  orderData?: EmailOrderContext | null;
  complete?: ChatComplete;
}): Promise<string> {
  const messages = buildEmailReplyMessages({
    knowledge: input.knowledge,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    subject: input.subject,
    body: input.body,
    orderData: input.orderData ?? null,
  });
  const complete = input.complete ?? defaultOpenAiComplete;
  const raw = await complete(messages);
  return finalizeEmailReply(raw, {
    knowledge: input.knowledge,
    fromName: input.fromName,
    subject: input.subject,
    body: input.body,
  });
}

export function emailKnowledgeWasCopied(reply: string, knowledge: KnowledgeBase) {
  const published = knowledgePrompt(knowledge);
  if (published.length < 80) return false;
  const body = unwrapEmailBody(reply);
  if (body.includes(knowledge.description.trim()) && knowledge.description.trim().length > 160) {
    return true;
  }
  return looksLikeKnowledgeDump(reply, knowledge);
}
