import {
  detectPromptInjection,
  findKnowledgeConflicts,
  isCannedKnowledgeFallback,
} from "@/lib/ai/email-identity";
import {
  buildSocialDraftMessages,
  isCustomerSupportSocialReply,
  type SocialDraftChatMessage,
  type SocialHashtagMode,
  type SocialMode,
  type SocialPostGoal,
  type SocialTone,
} from "@/lib/ai/social-prompt";
import { BillingError } from "@/lib/billing/types";
import { formatHoursList } from "@/lib/reply-engine";
import type { KnowledgeBase, ReplyIntent, ReplySource, SocialPlatform } from "@/lib/types";

export type SocialChatComplete = (messages: SocialDraftChatMessage[]) => Promise<string>;

export type SocialDraftInput = {
  knowledge: KnowledgeBase;
  platform: SocialPlatform;
  mode: SocialMode;
  body: string;
  fromName?: string;
  tone?: SocialTone;
  goal?: SocialPostGoal;
  hashtags?: SocialHashtagMode;
  customHashtags?: string;
  cta?: string;
  link?: string;
  language?: string;
  complete?: SocialChatComplete;
  workspaceId?: string;
};

const FORBIDDEN_HEADING_RE =
  /(?:^|\n)\s*(?:#{1,6}\s*)?(?:Knowledge|Store Information|Business Information|Customer Support Knowledge|SYSTEM INSTRUCTIONS|BUSINESS KNOWLEDGE|WORKSPACE IDENTITY|REQUIRED OUTPUT|About the business)\s*:?\s*(?:\n|$)/i;

const POSTED_CLAIM_RE =
  /\b(i('ve| have) (posted|published|uploaded|sent) (this|it)|this (has been|was) (posted|published)|posted (to|on) (instagram|facebook|tiktok|messenger))\b/i;

const VIDEO_CREATED_RE =
  /\b(i (made|created|filmed|shot|recorded) (this |a |the )?video|the video (is|was) (ready|posted|created))\b/i;

const lastGenerationAt = new Map<string, number>();
const inFlight = new Set<string>();
const GENERATION_GAP_MS = 450;

function sentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((row) => row.trim())
    .filter((row) => row.length >= 28);
}

function factCandidates(knowledge: KnowledgeBase) {
  const rows: string[] = [];
  if (knowledge.store?.shippingPolicy.trim()) rows.push(knowledge.store.shippingPolicy.trim());
  if (knowledge.store?.paymentMethods.trim()) rows.push(knowledge.store.paymentMethods.trim());
  if (knowledge.store?.stockMessaging.trim()) rows.push(knowledge.store.stockMessaging.trim());
  if (knowledge.pricingNotes.trim()) rows.push(knowledge.pricingNotes.trim());
  if (knowledge.serviceOps?.bookingLeadTime.trim()) rows.push(knowledge.serviceOps.bookingLeadTime.trim());
  if (knowledge.clinicOps?.appointmentBooking.trim()) rows.push(knowledge.clinicOps.appointmentBooking.trim());
  if (knowledge.contact.instagram.trim()) rows.push(`Instagram: ${knowledge.contact.instagram.trim()}`);
  if (knowledge.contact.facebook.trim()) rows.push(`Facebook: ${knowledge.contact.facebook.trim()}`);
  if (knowledge.contact.tiktok.trim()) rows.push(`TikTok: ${knowledge.contact.tiktok.trim()}`);
  if (knowledge.contact.messenger.trim()) rows.push(`Messenger: ${knowledge.contact.messenger.trim()}`);
  if (knowledge.contact.website.trim()) rows.push(`Website: ${knowledge.contact.website.trim()}`);
  if (knowledge.contact.email.trim()) rows.push(`Email: ${knowledge.contact.email.trim()}`);
  if (knowledge.contact.phone.trim()) rows.push(`Phone: ${knowledge.contact.phone.trim()}`);
  for (const policy of knowledge.policies ?? []) {
    const text = [policy.title.trim(), policy.summary.trim()].filter(Boolean).join(": ");
    if (text) rows.push(text);
  }
  for (const faq of knowledge.faqs ?? []) {
    if (faq.answer.trim()) rows.push(`${faq.question.trim()} ${faq.answer.trim()}`.trim());
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

export function pickRelevantSocialFacts(knowledge: KnowledgeBase, query: string) {
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
  if (/\binstagram\b/i.test(query) && knowledge.contact.instagram.trim()) {
    const handle = `Instagram: ${knowledge.contact.instagram.trim()}`;
    if (!unique.includes(handle)) unique.unshift(handle);
  }
  if (/\b(ship|shipping|delivery)\b/i.test(query) && knowledge.store?.shippingPolicy.trim()) {
    const shipping = knowledge.store.shippingPolicy.trim();
    if (!unique.includes(shipping)) unique.unshift(shipping);
  }
  if (knowledge.hours && /\b(hours?|open|opening|close|closing|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(query)) {
    const hourLines = formatHoursList(knowledge).split("\n").map((line) => line.trim()).filter(Boolean);
    const mentionedDays = knowledge.hours.days.filter((day) => new RegExp(`\\b${day.day}\\b`, "i").test(query));
    if (mentionedDays.length) {
      for (const day of mentionedDays) {
        const line = hourLines.find((row) => row.toLowerCase().startsWith(day.day));
        if (line && !unique.includes(line)) unique.unshift(line);
      }
    } else if (hourLines.length) {
      const bundled = hourLines.join("\n");
      if (bundled && !unique.includes(bundled)) unique.unshift(bundled);
    }
  }
  return unique.filter((fact) => !detectPromptInjection(fact)).slice(0, 4);
}

export function collectSocialSources(knowledge: KnowledgeBase, facts: string[]): ReplySource[] {
  const sources: ReplySource[] = [];
  for (const fact of facts) {
    if (knowledge.store?.shippingPolicy.trim() && fact.includes(knowledge.store.shippingPolicy.trim())) {
      sources.push({ kind: "store", title: "Shipping" });
    } else if (knowledge.contact.instagram && fact.includes(knowledge.contact.instagram)) {
      sources.push({ kind: "contact", title: "Instagram" });
    } else if (knowledge.hours && /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(fact)) {
      sources.push({ kind: "hours", title: "Hours" });
    } else if ((knowledge.offerings ?? []).some((row) => row.name.trim() && fact.includes(row.name.trim()))) {
      sources.push({ kind: "offering", title: "Offering" });
    } else if ((knowledge.policies ?? []).some((row) => row.title.trim() && fact.includes(row.title.trim()))) {
      sources.push({ kind: "policy", title: "Policy" });
    }
  }
  const seen = new Set<string>();
  return sources.filter((row) => {
    const key = `${row.kind}:${row.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function usedInternalSocialKnowledge(knowledge: KnowledgeBase, query: string) {
  return (knowledge.documents ?? []).some(
    (doc) =>
      doc.visibility === "internal" &&
      doc.body.trim() &&
      overlapScore(query, `${doc.title} ${doc.body}`) >= 0.2,
  );
}

function extractUrls(text: string) {
  return text.match(/https?:\/\/[^\s)]+/gi) ?? [];
}

export function preserveProvidedLinks(draft: string, source: string) {
  const urls = extractUrls(source);
  let out = draft;
  for (const url of urls) {
    if (!out.includes(url)) out = `${out.trim()}\n\n${url}`;
  }
  return out;
}

function looksSpanish(text: string) {
  return /[áéíóúñ¿¡]|\b(hola|gracias|cuándo|dónde|por favor|ustedes|buenos días)\b/i.test(text);
}

function firstName(fromName?: string) {
  const first = fromName?.trim().split(/\s+/)[0];
  if (!first || first.startsWith("@") || first.toLowerCase() === "customer") return "";
  return first.replace(/^@/, "");
}

function toneOpener(tone: SocialTone, mode: SocialMode, name: string, spanish: boolean) {
  if (spanish) {
    if (mode === "reply" && name) return `Hola ${name},`;
    if (tone === "casual") return "Hola,";
    return "Hola,";
  }
  if (mode === "reply" && name) {
    if (tone === "casual") return `Hey ${name},`;
    if (tone === "confident") return `Absolutely, ${name} —`;
    if (tone === "friendly") return `Hi ${name}, happy to help.`;
    if (tone === "professional") return `Hello ${name},`;
    if (tone === "educational") return `Hi ${name}, here's what to know.`;
    if (tone === "promotional") return `Hi ${name},`;
    return `Hi ${name},`;
  }
  if (tone === "casual") return "Hey,";
  if (tone === "confident") return "Absolutely —";
  if (tone === "promotional") return "Don't miss this:";
  if (tone === "educational") return "Here's what to know:";
  if (tone === "professional") return "";
  return "";
}

function suggestedHashtags(
  knowledge: KnowledgeBase,
  platform: SocialPlatform,
  topic: string,
  mode: SocialHashtagMode,
  custom?: string,
) {
  if (platform === "messenger" || mode === "none") return [];
  if (mode === "custom") {
    return (custom ?? "")
      .split(/[\s,]+/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/, "")}`));
  }
  const seeds = [knowledge.industry, knowledge.name, topic]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .slice(0, 8);
  const tags = Array.from(new Set(seeds.map((token) => `#${token}`)));
  const limit = platform === "facebook" ? 2 : 5;
  return tags.slice(0, limit);
}

function splitQuestions(body: string) {
  const parts = body
    .split(/(?<=[?])\s+/)
    .map((row) => row.trim())
    .filter(Boolean);
  return parts.length ? parts : [body.trim()];
}

function isDescriptionSentence(knowledge: KnowledgeBase, fact: string) {
  return sentences(knowledge.description).some(
    (row) => fact.includes(row) || row.includes(fact),
  );
}

function answerQuestion(question: string, facts: string[], knowledge: KnowledgeBase) {
  const hoursFact = facts.find((fact) =>
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday|closed|\d{1,2}:\d{2}/i.test(fact),
  );
  if (
    /\b(hours?|open|opening|close|closing|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(
      question,
    ) &&
    hoursFact
  ) {
    return hoursFact;
  }
  const contactFact = facts.find((fact) =>
    /^(instagram|facebook|tiktok|messenger|website|email|phone):/i.test(fact),
  );
  if (/\b(instagram|facebook|tiktok|messenger|website|email|phone)\b/i.test(question) && contactFact) {
    return contactFact;
  }
  const shippingFact = facts.find((fact) => /ship|delivery|alaska|usps/i.test(fact));
  if (/\b(ship|shipping|delivery)\b/i.test(question) && shippingFact) {
    return shippingFact;
  }

  const needsSpecific =
    /\b(price|how much|discount|wholesale|guarantee|stock|available|policy|hours?|ship|refund|rate)\b/i.test(
      question,
    );
  const match = facts.find((fact) => overlapScore(question, fact) >= 0.16);
  if (match) {
    if (isDescriptionSentence(knowledge, match) && match.length > 120) {
      return "I can help with a specific published detail. What would you like to know?";
    }
    return match;
  }
  if (needsSpecific && !match) {
    return "That business-specific detail needs to be confirmed before it is promised.";
  }
  if (/\b(thank|thanks|hola|hello|hi\b)/i.test(question) && !needsSpecific) {
    return knowledge.name.trim()
      ? `Thanks for writing — ${knowledge.name.trim()} is glad you reached out.`
      : "Thanks for writing. Happy to help.";
  }
  return "";
}

function signOff(knowledge: KnowledgeBase, mode: SocialMode, body: string, spanish: boolean) {
  const name = knowledge.name.trim();
  if (!name) return "";
  if (mode === "post") return "";
  if (spanish) return `Un saludo,\n${name}`;
  if (isCustomerSupportSocialReply(mode, body) && !/\bsupport$/i.test(name)) {
    return `— ${name}`;
  }
  return `— ${name}`;
}

function tiktokHook(topic: string) {
  const clipped = topic.replace(/\s+/g, " ").trim().slice(0, 90);
  return clipped.endsWith("?") ? clipped : `${clipped}`;
}

export function composeSocialDraft(input: SocialDraftInput) {
  const tone = input.tone ?? "friendly";
  const mode = input.mode;
  const platform = input.platform;
  const hashtags = input.hashtags ?? "none";
  const query = [input.body, input.cta, input.link, input.language].filter(Boolean).join("\n");
  const facts = pickRelevantSocialFacts(input.knowledge, query);
  const spanish = Boolean(input.language?.match(/spanish|español/i)) || looksSpanish(input.body);
  const opener = toneOpener(tone, mode, firstName(input.fromName), spanish);
  const linkSource = [input.body, input.link ?? ""].join("\n");
  const tags = suggestedHashtags(input.knowledge, platform, input.body, hashtags, input.customHashtags);

  if (detectPromptInjection(input.body)) {
    const cautious = spanish
      ? "Gracias por escribir. Un persona revisará este mensaje antes de cualquier acción."
      : "Thanks for writing. A person needs to review this message before any action is taken.";
    return preserveProvidedLinks([opener, cautious, signOff(input.knowledge, mode, input.body, spanish)].filter(Boolean).join("\n\n"), linkSource);
  }

  if (mode === "reply") {
    const questions = splitQuestions(input.body);
    const answers = questions
      .map((question) => answerQuestion(question, facts, input.knowledge))
      .filter(Boolean);
    if (!answers.length) {
      answers.push(
        spanish
          ? "Gracias por el mensaje. Cuéntame un poco más para poder ayudarte con precisión."
          : "Thanks for the message. Tell me a bit more so I can help with the right details.",
      );
    }
    const cta = input.cta?.trim();
    const parts = [
      opener,
      answers.join(questions.length > 1 ? "\n\n" : " "),
      cta,
      signOff(input.knowledge, mode, input.body, spanish),
    ].filter(Boolean);
    let draft = parts.join("\n\n");
    if (platform === "messenger") {
      draft = draft.replace(/(^|\s)#[\p{L}0-9_]+/gu, "$1").replace(/\n{3,}/g, "\n\n");
    }
    return preserveProvidedLinks(draft.trim(), linkSource);
  }

  const topic = input.body.trim();
  const factLine = facts[0] && facts[0].length < 220 ? facts[0] : "";
  const cta =
    input.cta?.trim() ||
    (input.goal === "traffic" || input.goal === "leads"
      ? "Send a message for details."
      : input.goal === "sales"
        ? "Shop or book through the link when you are ready."
        : input.goal === "announcement"
          ? "Save this note for later."
          : "Let us know what you think.");
  let body: string;
  if (platform === "tiktok") {
    body = [tiktokHook(topic), "", factLine, "", cta].filter((row) => row !== undefined).join("\n");
  } else if (platform === "instagram") {
    body = [topic, "", factLine, "", cta].filter(Boolean).join("\n");
  } else if (platform === "facebook") {
    body = [topic, factLine, cta].filter(Boolean).join("\n\n");
  } else {
    body = [opener, topic, cta].filter(Boolean).join("\n\n");
  }
  if (tone === "promotional" && !/don't miss/i.test(body)) {
    body = `${body}`;
  }
  const tagBlock = platform === "messenger" ? "" : tags.join(" ");
  const drafted = [opener && mode === "post" && platform !== "tiktok" ? opener : "", body, tagBlock]
    .filter(Boolean)
    .join("\n\n");
  return preserveProvidedLinks(drafted.trim(), linkSource);
}

export function looksLikeSocialKnowledgeDump(reply: string, knowledge: KnowledgeBase) {
  const body = reply.toLowerCase();
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
  return false;
}

export function stripInternalSocialLabels(text: string) {
  return text
    .replace(new RegExp(FORBIDDEN_HEADING_RE.source, "gi"), "\n")
    .replace(/^\s*Industry:\s.+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function socialIntentFromQuery(query: string, mode: SocialMode): ReplyIntent {
  if (mode === "post") return "unknown";
  const q = query.toLowerCase();
  if (/\b(antibiotic|diagnos|symptom|dosage|medication|prescription|sore throat)\b/i.test(q)) {
    return "medical_advice";
  }
  if (/\b(emergency|911|chest pain)\b/i.test(q)) return "emergency";
  if (/\b(hours?|open|opening|close|closing)\b/i.test(q)) return "hours";
  if (/\b(instagram|facebook|tiktok|phone|email|address|website)\b/i.test(q)) return "contact";
  if (/\b(ship|shipping|delivery)\b/i.test(q)) return "store_shipping";
  if (/\b(price|cost|how much|rate)\b/i.test(q)) return "pricing";
  if (/\b(refund|return|cancel|warranty)\b/i.test(q)) return "policy";
  if (/\b(complaint|disappointed|unacceptable)\b/i.test(q)) return "complaint";
  if (/\b(legal|lawsuit|attorney)\b/i.test(q)) return "legal";
  return "unknown";
}

function compactFallback(input: SocialDraftInput) {
  return composeSocialDraft(input);
}

export function finalizeSocialDraft(raw: string, input: SocialDraftInput) {
  const linkSource = [input.body, input.link ?? ""].join("\n");
  let text = stripInternalSocialLabels(raw || "");
  if (!text || looksLikeSocialKnowledgeDump(text, input.knowledge) || isCannedKnowledgeFallback(text)) {
    text = compactFallback(input);
  }
  if (detectPromptInjection(raw) || /SYSTEM INSTRUCTIONS/i.test(raw) || /<<UNTRUSTED_/i.test(raw)) {
    text = compactFallback({ ...input, body: "Please review this message." });
  }
  if (POSTED_CLAIM_RE.test(text) || (input.platform === "tiktok" && VIDEO_CREATED_RE.test(text))) {
    text = compactFallback(input);
  }
  if (findKnowledgeConflicts(input.knowledge).length && /\b(guaranteed|definitely|always)\b/i.test(text)) {
    text = compactFallback(input);
  }
  if (input.platform === "messenger") {
    text = text.replace(/(^|\s)#[\p{L}0-9_]+/gu, "$1").replace(/[ \t]{2,}/g, " ").trim();
  }
  return preserveProvidedLinks(text, linkSource);
}

function assertGenerationAllowed(workspaceId?: string) {
  if (!workspaceId) return;
  if (inFlight.has(workspaceId)) {
    throw new BillingError("A social draft is already being generated.", "limit");
  }
  const last = lastGenerationAt.get(workspaceId) ?? 0;
  if (Date.now() - last < GENERATION_GAP_MS) {
    throw new BillingError("Please wait a moment before generating another draft.", "limit");
  }
  lastGenerationAt.set(workspaceId, Date.now());
}

async function defaultOpenAiComplete(messages: SocialDraftChatMessage[]) {
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
      temperature: 0.35,
      max_tokens: 500,
      messages,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new BillingError("The social AI is unavailable right now. Press Regenerate to try again.", "invalid");
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new BillingError("The social AI returned an empty draft. Press Regenerate to try again.", "invalid");
  }
  return text;
}

export async function generateSocialDraft(input: SocialDraftInput): Promise<{
  body: string;
  operatorNote: string;
  intent: ReplyIntent;
  sources: ReplySource[];
  usedInternalKnowledge: boolean;
}> {
  const tone = input.tone ?? "friendly";
  const hashtags = input.hashtags ?? "none";
  const query = input.body;
  const facts = pickRelevantSocialFacts(input.knowledge, query);
  const intent = socialIntentFromQuery(query, input.mode);
  const sources = collectSocialSources(input.knowledge, facts);
  const usedInternalKnowledge = usedInternalSocialKnowledge(input.knowledge, query);
  const operatorNote =
    "AI creates a relevant social reply or post using your instructions and Knowledge as context. Review and edit the draft before copying. BizPilot never posts automatically.";
  try {
    if (!input.complete) assertGenerationAllowed(input.workspaceId);
    if (input.workspaceId) inFlight.add(input.workspaceId);
    const messages = buildSocialDraftMessages({
      knowledge: input.knowledge,
      platform: input.platform,
      mode: input.mode,
      body: input.body,
      fromName: input.fromName,
      tone,
      goal: input.goal,
      hashtags,
      customHashtags: input.customHashtags,
      cta: input.cta,
      link: input.link,
      language: input.language,
      facts,
    });
    const complete = input.complete ?? defaultOpenAiComplete;
    const raw = await complete(messages);
    const body = finalizeSocialDraft(raw, { ...input, tone, hashtags });
    return { body, operatorNote, intent, sources, usedInternalKnowledge };
  } catch (error) {
    if (error instanceof BillingError && error.code === "limit") throw error;
    return {
      body: finalizeSocialDraft("", { ...input, tone, hashtags }),
      operatorNote:
        "The AI draft could not be generated. Press Regenerate to try again. Nothing was posted. BizPilot never posts automatically.",
      intent,
      sources,
      usedInternalKnowledge,
    };
  } finally {
    if (input.workspaceId) inFlight.delete(input.workspaceId);
  }
}

export function socialKnowledgeWasCopied(reply: string, knowledge: KnowledgeBase) {
  const description = knowledge.description.trim();
  if (description.length > 160 && reply.includes(description)) return true;
  return looksLikeSocialKnowledgeDump(reply, knowledge);
}
