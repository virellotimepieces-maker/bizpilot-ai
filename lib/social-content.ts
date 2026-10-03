import { resolveConversationLanguage } from "@/lib/i18n/conversation-language";
import type { KnowledgeBase, SocialPlatform, SocialStatus } from "@/lib/types";
import type { ShopifyProductRecord } from "@/lib/shopify/types";
import type { WebsitePageRecord } from "@/lib/website/types";
import { SOCIAL_CONTENT_GOALS, SOCIAL_GOAL_LABEL, type SocialPostGoal } from "@/lib/social";

export const SOCIAL_CONTENT_LANGUAGES = [
  ["auto", "Auto"],
  ["en", "English"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["pt", "Portuguese"],
  ["de", "German"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
  ["tl", "Tagalog"],
  ["other", "Other"],
] as const;

export type SocialContentLanguage = (typeof SOCIAL_CONTENT_LANGUAGES)[number][0];

const LANGUAGE_NAME: Record<Exclude<SocialContentLanguage, "auto" | "other">, string> = {
  en: "English",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  tl: "Tagalog",
};

export function isSocialContentLanguage(value: string): value is SocialContentLanguage {
  return SOCIAL_CONTENT_LANGUAGES.some((row) => row[0] === value);
}

export function socialLanguageLabel(code: string) {
  if (!code || code === "auto") return "Auto";
  if (code in LANGUAGE_NAME) return LANGUAGE_NAME[code as keyof typeof LANGUAGE_NAME];
  return code;
}

export function resolveSocialContentLanguage(input: {
  choice?: string;
  instruction: string;
  other?: string;
}) {
  const choice = input.choice?.trim() || "auto";
  if (choice === "other") {
    const other = input.other?.trim().slice(0, 40) || "";
    return other || "en";
  }
  if (choice !== "auto" && choice in LANGUAGE_NAME) return choice;
  const detected = resolveConversationLanguage("", input.instruction);
  return detected || "en";
}

export function socialLanguageInstruction(code: string) {
  return socialLanguageLabel(code);
}

export function isSocialContentGoal(value: string): value is (typeof SOCIAL_CONTENT_GOALS)[number] {
  return (SOCIAL_CONTENT_GOALS as readonly string[]).includes(value);
}

export function socialWorkflowStatus(status: string): "Draft" | "Approved" | "Published" | "Failed" {
  if (status === "published") return "Published";
  if (status === "failed") return "Failed";
  if (status === "approved" || status === "posted") return "Approved";
  return "Draft";
}

export function socialPublishBlockedReason() {
  return "Connect the social account before publishing. Nothing is posted automatically.";
}

export function canPublishSocialDraft(_status: SocialStatus | string) {
  return false;
}

export function clientMaySetSocialStatus(status: string) {
  return status === "draft" || status === "approved" || status === "draft_ready";
}

function clip(text: string, max: number) {
  const value = text.replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export function verifiedSocialFacts(input: {
  knowledge: KnowledgeBase;
  instruction: string;
  goal: SocialPostGoal;
  workspaceId: string;
  pages?: WebsitePageRecord[];
  products?: ShopifyProductRecord[];
}) {
  const facts: string[] = [];
  const name = input.knowledge.name.trim();
  if (name) facts.push(name);
  const pages = (input.pages ?? []).filter((page) => page.workspaceId === input.workspaceId);
  const products = (input.products ?? []).filter(
    (product) => product.workspaceId === input.workspaceId && product.status !== "draft",
  );
  const instruction = input.instruction.toLowerCase();
  const wantsProduct =
    input.goal === "promote_product" ||
    input.goal === "product_spotlight" ||
    input.goal === "offer" ||
    products.some((product) => instruction.includes(product.title.toLowerCase()));
  if (wantsProduct) {
    const ranked = [...products].sort((a, b) => {
      const aHit = instruction.includes(a.title.toLowerCase()) ? 1 : 0;
      const bHit = instruction.includes(b.title.toLowerCase()) ? 1 : 0;
      return bHit - aHit;
    });
    for (const product of ranked.slice(0, 3)) {
      const price = product.variants.find((variant) => variant.price.trim())?.price.trim() ?? "";
      const bits = [product.title.trim(), clip(product.description, 180), price ? `Price: ${price}` : "", product.url.trim()]
        .filter(Boolean);
      facts.push(bits.join(". "));
    }
  }
  for (const page of pages) {
    const title = page.title.trim();
    if (!title) continue;
    const overlap = instruction && title.toLowerCase().split(/\s+/).some((word) => word.length > 3 && instruction.includes(word));
    if (!overlap && input.goal !== "business_update") continue;
    facts.push([title, clip(page.content, 180), page.url.trim()].filter(Boolean).join(". "));
    if (facts.length >= 6) break;
  }
  if (input.knowledge.contact.website.trim() && /\b(website|site|link|url)\b/i.test(input.instruction)) {
    facts.push(input.knowledge.contact.website.trim());
  }
  return facts.filter((fact) => fact.trim()).slice(0, 6);
}

export function contentTopic(goal: SocialPostGoal, instruction: string) {
  const note = instruction.trim();
  const label = SOCIAL_GOAL_LABEL[goal];
  return note ? `${label}. ${note}` : label;
}
