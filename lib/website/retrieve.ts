import { jaccard, pageRecency, tokenize } from "./conflicts";
import type { WebsitePageRecord } from "./types";

const KIND_HINTS: { re: RegExp; kinds: WebsitePageRecord["kind"][] }[] = [
  { re: /\b(ship|delivery|deliver|postage|freight)\b/i, kinds: ["shipping"] },
  { re: /\b(refund|return|exchange)\b/i, kinds: ["returns"] },
  { re: /\bprivacy\b/i, kinds: ["privacy"] },
  { re: /\b(terms|conditions)\b/i, kinds: ["terms"] },
  { re: /\bfaq\b|\bquestions?\b/i, kinds: ["faq"] },
  { re: /\babout\b|\bstory\b/i, kinds: ["about"] },
  { re: /\bcontact\b|\bemail\b|\bphone\b/i, kinds: ["contact"] },
  { re: /\b(product|price|buy|order)\b/i, kinds: ["product", "service"] },
];

export function retrieveRelevantPages(
  pages: WebsitePageRecord[],
  question: string,
  limit = 4,
) {
  const tokens = tokenize(question);
  if (!pages.length || !tokens.length) return [];
  const hinted = KIND_HINTS.filter((row) => row.re.test(question)).flatMap((row) => row.kinds);
  const scored = pages
    .map((page) => {
      const hay = `${page.title} ${page.content} ${page.url}`;
      let score = 0;
      for (const token of tokens) {
        if (hay.toLowerCase().includes(token)) score += 1;
      }
      score += jaccard(question, hay) * 4;
      if (hinted.includes(page.kind)) score += 3;
      return { page, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || pageRecency(b.page) - pageRecency(a.page));

  const chosen: WebsitePageRecord[] = [];
  for (const row of scored) {
    if (chosen.length >= limit) break;
    if (chosen.some((item) => item.url === row.page.url)) continue;
    chosen.push(row.page);
  }
  return chosen;
}

export function assertPagesBelongToWidget(
  pages: WebsitePageRecord[],
  workspaceId: string,
  widgetKey: string,
) {
  return pages.filter(
    (page) => page.workspaceId === workspaceId && page.widgetKey === widgetKey,
  );
}
