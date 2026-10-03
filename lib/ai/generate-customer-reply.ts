import { knowledgePrompt, WIDGET_SYSTEM_RULES } from "@/lib/ai/knowledge-prompt";
import { BillingError } from "@/lib/billing/types";
import { isEnglishLanguage, languageName } from "@/lib/i18n/localize";
import {
  CATALOG_NO_SOURCE_ANSWER,
  groundedCatalogAnswer,
  retrieveRelevantProducts,
  shopifyCatalogPrompt,
} from "@/lib/shopify/catalog";
import type { ShopifyProductRecord } from "@/lib/shopify/types";
import type { KnowledgeBase } from "@/lib/types";
import { groundedWebsiteAnswer, websitePagesPrompt, WEBSITE_NO_SOURCE_ANSWER } from "@/lib/website/answer";
import { retrieveRelevantPages } from "@/lib/website/retrieve";
import type { WebsitePageRecord } from "@/lib/website/types";

export async function generateCustomerReply(
  knowledge: KnowledgeBase | null,
  question: string,
  pages: WebsitePageRecord[] = [],
  products: ShopifyProductRecord[] = [],
  language = "",
): Promise<string> {
  const sample = pages[0];
  const workspaceId = sample?.workspaceId || products[0]?.workspaceId || "";
  const widgetKey = sample?.widgetKey ?? "";
  const scopedProducts = workspaceId
    ? products.filter((row) => row.workspaceId === workspaceId)
    : [];
  const grounded = groundedWebsiteAnswer({
    question,
    pages,
    workspaceId,
    widgetKey,
    knowledge,
  });
  const catalog = workspaceId
    ? groundedCatalogAnswer({ question, products: scopedProducts, workspaceId })
    : { answer: CATALOG_NO_SOURCE_ANSWER, usedCatalog: false, products: [] };
  const relevant = sample
    ? retrieveRelevantPages(
        pages.filter(
          (page) => page.workspaceId === sample.workspaceId && page.widgetKey === sample.widgetKey,
        ),
        question,
      )
    : [];
  const relevantProducts = workspaceId
    ? retrieveRelevantProducts(scopedProducts, question, workspaceId)
    : [];

  const hasPublished =
    Boolean(knowledge?.description && knowledge.description.trim()) ||
    Boolean(knowledge?.name && knowledge.name.trim());
  if (!relevant.length && !relevantProducts.length && grounded.answer === WEBSITE_NO_SOURCE_ANSWER && !hasPublished) {
    return WEBSITE_NO_SOURCE_ANSWER;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (catalog.usedCatalog) return catalog.answer;
    if (grounded.usedWebsite) return grounded.answer;
    throw new BillingError(
      "AI replies are not configured. Set OPENAI_API_KEY for paid widget answers.",
      "misconfigured",
    );
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
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `${WIDGET_SYSTEM_RULES}${languageInstruction(language)}\n\nIndexed website pages (include facts only from these URLs):\n${websitePagesPrompt(relevant)}\n\nConnected Shopify catalog (active products for this workspace only; never invent missing fields):\n${shopifyCatalogPrompt(relevantProducts)}\n\nPublished knowledge:\n${knowledgePrompt(knowledge)}`,
        },
        { role: "user", content: question },
      ],
    }),
  });
  if (!response.ok) {
    throw new Error(`model_http_${response.status}`);
  }
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("model_empty");
  }
  return text;
}

function languageInstruction(language: string) {
  if (isEnglishLanguage(language)) return "";
  return `\n\nReply in ${languageName(language)}. Do not translate proper names, emails, prices, URLs, or dates into different facts. Do not invent store facts.`;
}
