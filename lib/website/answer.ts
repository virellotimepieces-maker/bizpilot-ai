import type { KnowledgeBase } from "@/lib/types";
import { assertPagesBelongToWidget, retrieveRelevantPages } from "./retrieve";
import type { WebsitePageRecord, WebsiteReplySource } from "./types";

export const WEBSITE_NO_SOURCE_ANSWER =
  "I don’t have a reliable source for that on this business’s website. I can loop in a teammate who can help.";

export function websitePagesPrompt(pages: WebsitePageRecord[]) {
  if (!pages.length) return "No indexed website pages are available for this subscriber.";
  return pages
    .map(
      (page) =>
        `Source URL: ${page.url}\nTitle: ${page.title || "(untitled)"}\nKind: ${page.kind}\n${page.content.slice(0, 2500)}`,
    )
    .join("\n\n---\n\n");
}

export function groundedWebsiteAnswer(input: {
  question: string;
  pages: WebsitePageRecord[];
  workspaceId: string;
  widgetKey: string;
  knowledge?: KnowledgeBase | null;
}): { answer: string; sources: WebsiteReplySource[]; usedWebsite: boolean } {
  const scoped = assertPagesBelongToWidget(input.pages, input.workspaceId, input.widgetKey);
  const relevant = retrieveRelevantPages(scoped, input.question);
  if (relevant.length) {
    const top = relevant[0];
    const snippet = top.content.slice(0, 420).trim();
    return {
      answer: snippet
        ? `${snippet}${snippet.length === 420 ? "…" : ""}`
        : WEBSITE_NO_SOURCE_ANSWER,
      sources: relevant.map((page) => ({
        title: page.title || page.url,
        url: page.url,
        kind: page.kind,
      })),
      usedWebsite: true,
    };
  }

  const knowledgeText = [
    input.knowledge?.description,
    input.knowledge?.faqs?.map((row) => `${row.question} ${row.answer}`).join(" "),
    input.knowledge?.policies?.map((row) => `${row.title} ${row.summary}`).join(" "),
    input.knowledge?.offerings?.map((row) => `${row.name} ${row.summary}`).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tokens = input.question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
  const knowledgeHit = tokens.some((token) => knowledgeText.includes(token));
  if (!knowledgeHit) {
    return { answer: WEBSITE_NO_SOURCE_ANSWER, sources: [], usedWebsite: false };
  }
  return {
    answer: "",
    sources: [],
    usedWebsite: false,
  };
}
