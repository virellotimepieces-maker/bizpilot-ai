import { knowledgePrompt, WIDGET_SYSTEM_RULES } from "@/lib/ai/knowledge-prompt";
import { BillingError } from "@/lib/billing/types";
import type { KnowledgeBase } from "@/lib/types";
import { groundedWebsiteAnswer, websitePagesPrompt, WEBSITE_NO_SOURCE_ANSWER } from "@/lib/website/answer";
import { retrieveRelevantPages } from "@/lib/website/retrieve";
import type { WebsitePageRecord } from "@/lib/website/types";

export async function generateCustomerReply(
  knowledge: KnowledgeBase | null,
  question: string,
  pages: WebsitePageRecord[] = [],
): Promise<string> {
  const sample = pages[0];
  const grounded = groundedWebsiteAnswer({
    question,
    pages,
    workspaceId: sample?.workspaceId ?? "",
    widgetKey: sample?.widgetKey ?? "",
    knowledge,
  });
  const relevant = sample
    ? retrieveRelevantPages(
        pages.filter(
          (page) => page.workspaceId === sample.workspaceId && page.widgetKey === sample.widgetKey,
        ),
        question,
      )
    : [];

  if (!relevant.length && grounded.answer === WEBSITE_NO_SOURCE_ANSWER && !knowledge?.description && !knowledge?.name) {
    return WEBSITE_NO_SOURCE_ANSWER;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
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
          content: `${WIDGET_SYSTEM_RULES}\n\nIndexed website pages (include facts only from these URLs):\n${websitePagesPrompt(relevant)}\n\nPublished knowledge:\n${knowledgePrompt(knowledge)}`,
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
