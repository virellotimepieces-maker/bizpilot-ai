import { BillingError } from "@/lib/billing/types";
import type { KnowledgeBase } from "@/lib/types";

function knowledgePrompt(knowledge: KnowledgeBase | null) {
  if (!knowledge) {
    return "The business has not published a knowledge base yet. Do not invent offerings, prices, or policies.";
  }
  return [
    `Business name: ${knowledge.name || "(untitled)"}`,
    knowledge.tagline && `Tagline: ${knowledge.tagline}`,
    knowledge.industry && `Industry: ${knowledge.industry}`,
    knowledge.description && `About the business:\n${knowledge.description}`,
    knowledge.pricingNotes && `Prices or rates:\n${knowledge.pricingNotes}`,
    knowledge.offerings
      ?.filter((row) => row.name.trim())
      .map(
        (row) =>
          `- ${row.name}: ${row.summary} ${row.price ? `Price ${row.price}.` : ""} ${row.availability ? `Availability ${row.availability}.` : ""}`,
      )
      .join("\n"),
    knowledge.policies
      ?.filter((row) => row.title.trim())
      .map((row) => `- ${row.title}: ${row.summary}`)
      .join("\n"),
    knowledge.faqs
      ?.filter((row) => row.question.trim())
      .map((row) => `Q: ${row.question}\nA: ${row.answer}`)
      .join("\n"),
    knowledge.documents
      ?.filter((row) => row.visibility === "public" && row.body.trim())
      .map((row) => `${row.title}:\n${row.body}`)
      .join("\n"),
    knowledge.contact &&
      `Contact: ${[knowledge.contact.phone, knowledge.contact.email, knowledge.contact.address].filter(Boolean).join(" · ")}`,
    knowledge.escalation?.handoffMessage &&
      `When you cannot answer, offer this handoff: ${knowledge.escalation.handoffMessage}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateCustomerReply(
  knowledge: KnowledgeBase | null,
  question: string,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
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
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are the website chat assistant for one business on BizPilot AI. Answer only from the published knowledge below. If the knowledge does not contain the answer, say the information is unavailable and offer a human teammate. Never invent prices, policies, or capabilities.\n\n${knowledgePrompt(knowledge)}`,
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
