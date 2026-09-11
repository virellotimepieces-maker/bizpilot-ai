import { createHash, randomBytes } from "node:crypto";
import { detectWebsiteConflicts } from "./conflicts";
import { extractPageText, hashText } from "./extract";
import { parseSitemapXml, sitemapCandidates } from "./sitemap";
import {
  classifyWebsitePage,
  isPrivateOrUnsafeUrl,
  isSameRegisteredDomain,
  shouldIndexWebsiteUrl,
  websiteOrigin,
  websitePagePriority,
} from "./urls";
import { verifyWebsiteOwnership, type WebsiteFetchLike } from "./verify";
import {
  WEBSITE_FETCH_TIMEOUT_MS,
  WEBSITE_MAX_PAGES,
  WEBSITE_MAX_SITEMAPS,
  WEBSITE_SYNC_INTERVAL_MS,
  type WebsitePageRecord,
  type WebsiteSourceRecord,
} from "./types";

export { verifyWebsiteOwnership };

export type FetchLike = WebsiteFetchLike;

const BOT_HEADERS = {
  "User-Agent": "BizPilotWebsiteIndexer/1.0",
  Accept: "text/html,application/xml,text/xml;q=0.9,*/*;q=0.8",
};

export function newWebsiteVerifyToken() {
  return `bpv_${randomBytes(16).toString("hex")}`;
}

export function contentSha(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function readUrl(fetchImpl: FetchLike, url: string) {
  const response = await fetchImpl(url, {
    headers: BOT_HEADERS,
    signal: AbortSignal.timeout(WEBSITE_FETCH_TIMEOUT_MS),
  });
  const body = await response.text();
  return { ...response, body };
}

async function collectSitemapUrls(origin: string, domain: string, fetchImpl: FetchLike) {
  const found: { loc: string; lastmod?: string }[] = [];
  const seenSitemaps = new Set<string>();
  for (const candidate of sitemapCandidates(origin)) {
    const response = await readUrl(fetchImpl, candidate).catch(() => null);
    if (!response?.ok) continue;
    const parsed = parseSitemapXml(response.body);
    for (const entry of parsed) {
      if (entry.sitemap) {
        if (seenSitemaps.size >= WEBSITE_MAX_SITEMAPS) continue;
        if (seenSitemaps.has(entry.loc)) continue;
        if (!isSameRegisteredDomain(entry.loc, domain) && !entry.loc.includes(domain)) continue;
        seenSitemaps.add(entry.loc);
        const child = await readUrl(fetchImpl, entry.loc).catch(() => null);
        if (!child?.ok) continue;
        for (const url of parseSitemapXml(child.body)) {
          if (!url.sitemap) found.push(url);
        }
      } else {
        found.push(entry);
      }
    }
    if (found.length) break;
  }
  return found;
}

function selectIndexableUrls(
  domain: string,
  entries: { loc: string; lastmod?: string }[],
) {
  const unique = new Map<string, { loc: string; lastmod?: string }>();
  for (const entry of entries) {
    if (!isSameRegisteredDomain(entry.loc, domain)) continue;
    if (!shouldIndexWebsiteUrl(entry.loc)) continue;
    unique.set(entry.loc, entry);
  }
  return [...unique.values()]
    .sort(
      (a, b) =>
        websitePagePriority(classifyWebsitePage(a.loc)) -
        websitePagePriority(classifyWebsitePage(b.loc)),
    )
    .slice(0, WEBSITE_MAX_PAGES);
}

export async function crawlWebsitePages(input: {
  source: WebsiteSourceRecord;
  fetchImpl?: FetchLike;
  now?: Date;
}): Promise<{ pages: Omit<WebsitePageRecord, "id">[]; conflictWarning: string | null; error?: string }> {
  const now = input.now ?? new Date();
  const fetchImpl = input.fetchImpl ?? fetch;
  const origin = websiteOrigin(input.source.domain);
  const sitemapEntries = await collectSitemapUrls(origin, input.source.domain, fetchImpl);
  const selected = selectIndexableUrls(input.source.domain, sitemapEntries);
  if (!selected.length) {
    selected.push({ loc: `${origin}/` });
  }

  const pages: Omit<WebsitePageRecord, "id">[] = [];
  for (const entry of selected) {
    if (isPrivateOrUnsafeUrl(entry.loc)) continue;
    const response = await readUrl(fetchImpl, entry.loc).catch(() => null);
    if (!response?.ok) continue;
    const finalUrl = response.url || entry.loc;
    if (!isSameRegisteredDomain(finalUrl, input.source.domain)) continue;
    if (isPrivateOrUnsafeUrl(finalUrl)) continue;
    const extracted = extractPageText(response.body);
    if (!extracted.text.trim()) continue;
    const lastModifiedHeader = response.headers.get("last-modified");
    const lastModified = entry.lastmod
      ? new Date(entry.lastmod)
      : lastModifiedHeader
        ? new Date(lastModifiedHeader)
        : null;
    pages.push({
      workspaceId: input.source.workspaceId,
      widgetKey: input.source.widgetKey,
      sourceId: input.source.id,
      url: finalUrl,
      title: extracted.title,
      kind: classifyWebsitePage(finalUrl, extracted.title),
      content: extracted.text,
      contentHash: contentSha(extracted.text) || hashText(extracted.text),
      lastModified: lastModified && !Number.isNaN(lastModified.getTime()) ? lastModified : null,
      fetchedAt: now,
    });
  }

  const asRecords = pages.map((page, index) => ({
    ...page,
    id: `tmp_${index}`,
  }));
  const warnings = detectWebsiteConflicts(asRecords);
  return {
    pages,
    conflictWarning: warnings[0] ?? null,
  };
}

export function nextWebsiteSyncAt(from: Date) {
  return new Date(from.getTime() + WEBSITE_SYNC_INTERVAL_MS);
}
