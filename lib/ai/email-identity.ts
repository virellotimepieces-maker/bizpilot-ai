import type { BusinessType, KnowledgeBase } from "@/lib/types";

export const EMAIL_AI_HELPER_COPY =
  "AI drafts a relevant reply from the incoming email, using your Knowledge as optional business or personal context. Review before sending. Email never auto-sends.";

export type EmailConversationKind =
  | "customer_support"
  | "sales_vendor"
  | "personal"
  | "appointment"
  | "quote"
  | "order"
  | "complaint"
  | "suspicious"
  | "general";

export type EmailMailboxKind = "store" | "service" | "clinic" | "personal" | "general";

const SALES_RE =
  /\b(partner(ship)?|seo|backlink|guest post|vendor|supplier|wholesaler|marketing (service|agency|offer)|increase (your )?(traffic|sales|ranking)|book a (demo|call)|synerg|unsolicited|we (help|can) (you )?(rank|grow)|our agency|introduc(e|ing) (our|my) (company|service|tool)|paid placement)\b/i;

const PHISHING_RE =
  /\b(verify your (account|password|login)|confirm your password|wire transfer|gift cards?|crypto wallet|urgent payment|update (your )?(bank|payroll|direct deposit)|send (me )?(the )?otp|one-time (code|password)|login here|click (the )?link below)\b/i;

const INJECTION_RE =
  /ignore (all |any )?(previous|prior|above) instructions|reveal (your )?(system )?prompt|dump (the )?(full )?knowledge|you are now|jailbreak|override (the )?system/i;

const APPOINTMENT_RE =
  /\b(appoint(ment)?|book(ing)?|reserv(e|ation)|viewing|consult(ation)?|schedule a|available (on|this|next))\b/i;

const QUOTE_RE =
  /\b(quot(e|ation)|estimate|proposal|how much (would|for|to)|project (rate|fee|budget|inquiry)|scope of (work|the project)|timeline|typical rate|what(?:'s| is) your (rate|fee|price))\b/i;

const ORDER_RE =
  /\b(order status|where is my order|track(ing)? (my |this )?order|my (order|package|shipment))\b/i;

const COMPLAINT_RE =
  /\b(complaint|disappointed|unacceptable|never arrived|damaged|wrong item|refund|cancel(lation)?)\b/i;

const PERSONAL_RE =
  /\b(dinner|birthday|weekend|miss you|how are you|catch up|family|congrats|congratulations|see you (soon|then))\b/i;

export function detectPromptInjection(text: string) {
  return INJECTION_RE.test(text);
}

export function detectSuspiciousEmail(text: string) {
  return PHISHING_RE.test(text) || detectPromptInjection(text);
}

export function classifyEmailConversation(subject: string, body: string): EmailConversationKind {
  const text = `${subject}\n${body}`;
  if (detectSuspiciousEmail(text)) return "suspicious";
  if (SALES_RE.test(text)) return "sales_vendor";
  if (ORDER_RE.test(text)) return "order";
  if (COMPLAINT_RE.test(text)) return "complaint";
  if (APPOINTMENT_RE.test(text)) return "appointment";
  if (QUOTE_RE.test(text)) return "quote";
  if (PERSONAL_RE.test(text)) return "personal";
  return "general";
}

export function mailboxKindForKnowledge(kb: KnowledgeBase): EmailMailboxKind {
  if (kb.businessType === "online_store") return "store";
  if (kb.businessType === "service") return "service";
  if (kb.businessType === "clinic") return "clinic";
  const hasOfferings = (kb.offerings ?? []).some((row) => row.name.trim());
  if (!hasOfferings && !kb.store && !kb.serviceOps && !kb.clinicOps) return "personal";
  return "general";
}

export function conversationUsesSupportClosing(
  kind: EmailConversationKind,
  mailbox: EmailMailboxKind,
) {
  if (kind === "personal" || kind === "sales_vendor") return false;
  if (mailbox === "personal") return false;
  return kind === "customer_support" || kind === "order" || kind === "complaint" || mailbox === "store" || mailbox === "clinic";
}

export function emailDisplayName(kb: KnowledgeBase) {
  return kb.name.trim() || "";
}

export function emailClosingFor(kb: KnowledgeBase, kind: EmailConversationKind) {
  const name = emailDisplayName(kb);
  if (!name) return "";
  const mailbox = mailboxKindForKnowledge(kb);
  if (!conversationUsesSupportClosing(kind, mailbox)) return name;
  return /\bsupport$/i.test(name) ? name : `${name} Support`;
}

export function workspaceIdentityBlock(kb: KnowledgeBase, kind: EmailConversationKind) {
  const mailbox = mailboxKindForKnowledge(kb);
  const closing = emailClosingFor(kb, kind);
  const typeLabel: Record<BusinessType, string> = {
    online_store: "online store",
    service: "service business",
    clinic: "clinic",
    custom: mailbox === "personal" ? "personal mailbox" : "custom workspace",
  };
  return [
    `Display name: ${emailDisplayName(kb) || "(not configured)"}`,
    `Mailbox kind: ${mailbox}`,
    `Conversation kind: ${kind}`,
    `Business type: ${typeLabel[kb.businessType]}`,
    `Industry: ${kb.industry.trim() || "(not set)"}`,
    `Tone: ${kb.voice.trim() || "professional, concise, and natural"}`,
    `Closing: ${closing || "(use the display name only; do not invent a title)"}`,
    "Language: reply in the sender’s language unless a workspace language is set",
    "Use this identity only. Do not use another workspace’s name, policies, or customers.",
    conversationUsesSupportClosing(kind, mailbox)
      ? "This conversation is customer support. The closing may include Support if shown above."
      : "Do not add Support, Customer Support, or “our business” unless the Closing line already includes it.",
  ].join("\n");
}

export const CANNED_KNOWLEDGE_FALLBACK_RE =
  /No published knowledge matched|published knowledge base|looping in a teammate|Published knowledge only|offer a human/i;

export function isCannedKnowledgeFallback(text: string) {
  return CANNED_KNOWLEDGE_FALLBACK_RE.test(text);
}

export function isPaymentMethodQuestion(text: string) {
  return /\b(paypal|shop ?pay|apple pay|google pay|klarna|afterpay|venmo|zelle|cash on delivery|payment methods?|credit cards?|debit cards?)\b/i.test(
    text,
  );
}

export const EMAIL_PAYMENT_CHECKOUT_GUIDANCE =
  "Thank you for your interest in placing an order. The payment methods currently available for your order will be displayed securely at checkout. Please proceed to checkout to confirm which options are available for your location and order.";

export function emailPaymentAnswer(kb: KnowledgeBase, query: string, connectedMethods?: string[] | null) {
  const connected = (connectedMethods ?? []).map((row) => row.trim()).filter(Boolean);
  if (connected.length) {
    return `Yes — checkout currently offers ${connected.join(", ")}.`;
  }
  const published = kb.store?.paymentMethods.trim();
  if (published) return `Thank you for your interest in placing an order. ${published}`;
  if (isPaymentMethodQuestion(query)) return EMAIL_PAYMENT_CHECKOUT_GUIDANCE;
  return "";
}

export function findKnowledgeConflicts(kb: KnowledgeBase) {
  const conflicts: string[] = [];
  const shipping = kb.store?.shippingPolicy.trim() ?? "";
  const desc = kb.description.trim();
  if (shipping && desc) {
    const usOnly = /united states only|us only|u\.s\. only/i.test(shipping);
    const worldwide = /worldwide|international shipping|ship (everywhere|globally)/i.test(desc);
    if (usOnly && worldwide) {
      conflicts.push("Shipping policy and the business description disagree about destinations.");
    }
  }
  const prices = (kb.offerings ?? [])
    .filter((row) => row.name.trim() && row.price.trim())
    .map((row) => ({ name: row.name.trim(), price: row.price.trim() }));
  for (let i = 0; i < prices.length; i += 1) {
    for (let j = i + 1; j < prices.length; j += 1) {
      if (prices[i].name.toLowerCase() === prices[j].name.toLowerCase() && prices[i].price !== prices[j].price) {
        conflicts.push(`Two different prices are published for ${prices[i].name}.`);
      }
    }
  }
  return conflicts;
}
