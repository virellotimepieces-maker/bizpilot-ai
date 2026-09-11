import type { WebsitePageKind, WebsitePageRecord } from "./types";

const STOP = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "do",
  "you",
  "to",
  "of",
  "and",
  "or",
  "for",
  "in",
  "on",
  "what",
  "when",
  "where",
  "how",
  "can",
  "our",
  "we",
  "your",
]);

export function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 2 && !STOP.has(token));
}

export function jaccard(a: string, b: string) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap += 1;
  return overlap / (left.size + right.size - overlap);
}

export function pageRecency(page: Pick<WebsitePageRecord, "lastModified" | "fetchedAt">) {
  return (page.lastModified ?? page.fetchedAt).getTime();
}

export function preferOfficialPages(pages: WebsitePageRecord[], kind: WebsitePageKind) {
  const matches = pages.filter((page) => page.kind === kind);
  return [...matches].sort((a, b) => pageRecency(b) - pageRecency(a));
}

export function detectWebsiteConflicts(pages: WebsitePageRecord[]) {
  const kinds: WebsitePageKind[] = ["shipping", "returns", "privacy", "terms", "faq"];
  const warnings: string[] = [];
  for (const kind of kinds) {
    const ranked = preferOfficialPages(pages, kind);
    if (ranked.length < 2) continue;
    const newest = ranked[0];
    const older = ranked[1];
    if (jaccard(newest.content, older.content) < 0.45) {
      warnings.push(
        `Conflicting ${kind} pages: preferring ${newest.url} (newer) over ${older.url}. Review these pages so customers get one official answer.`,
      );
    }
  }
  return warnings;
}
