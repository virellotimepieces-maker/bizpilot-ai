import { createHash, randomBytes } from "node:crypto";
import { detectWebsiteConflicts } from "./conflicts";
import { extractPageText, hashText } from "./extract";
import { fetchPublicUrl } from "./fetch-public";
import { parseSitemapXml, shopifyPolicyUrls, sitemapCandidates } from "./sitemap";
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
  WEBSITE_MAX_PAGES,
  WEBSITE_MAX_SITEMAPS,
  WEBSITE_SYNC_INTERVAL_MS,
  type WebsitePageRecord,
  type WebsiteSourceRecord,
  type WebsiteSyncDiagnostic,
} from "./types";

export { verifyWebsiteOwnership };

export type FetchLike = WebsiteFetchLike;

export function newWebsiteVerifyToken() {
  return `bpv_${randomBytes(16).toString("hex")}`;
}

export function contentSha(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function emptyWebsiteSyncDiagnostic(): WebsiteSyncDiagnostic {
  return {
    sitemapFetched: [],
    childSitemapsFound: 0,
    urlsDiscovered: 0,
    pagesIndexed: 0,
    pagesSkipped: 0,
    failures: 0,
  };
}

export function formatWebsiteSyncDiagnostic(diagnostic: WebsiteSyncDiagnostic) {
  const fetched =
    diagnostic.sitemapFetched
      .map(
        (row) =>
          `${row.url} (${row.status == null ? "no HTTP status" : `HTTP ${row.status}`})`,
      )
      .join("; ") || "none";
  return `Sitemap fetched: ${fetched}. Child sitemaps found: ${diagnostic.childSitemapsFound}. URLs discovered: ${diagnostic.urlsDiscovered}. Pages indexed: ${diagnostic.pagesIndexed}. Pages skipped: ${diagnostic.pagesSkipped}. Failures: ${diagnostic.failures}.`;
}

async function collectSitemapUrls(
  origin: string,
  domain: string,
  fetchImpl: FetchLike,
  diagnostic: WebsiteSyncDiagnostic,
) {
  const found: { loc: string; lastmod?: string }[] = [];
  const queue: string[] = [];
  const seenSitemaps = new Set<string>();

  for (const candidate of sitemapCandidates(origin)) {
    const response = await fetchPublicUrl(fetchImpl, candidate, domain).catch(() => null);
    diagnostic.sitemapFetched.push({
      url: response?.url ?? candidate,
      status: response?.status ?? null,
    });
    if (!response?.ok) {
      diagnostic.failures += 1;
      continue;
    }
    const parsed = parseSitemapXml(response.body);
    if (parsed.some((entry) => entry.sitemap)) {
      for (const entry of parsed) {
        if (entry.sitemap && entry.loc) queue.push(entry.loc);
      }
    } else {
      found.push(...parsed);
    }
    if (parsed.length) break;
  }

  while (queue.length && seenSitemaps.size < WEBSITE_MAX_SITEMAPS) {
    const loc = queue.shift();
    if (!loc || seenSitemaps.has(loc)) continue;
    if (!isSameRegisteredDomain(loc, domain) && !loc.includes(domain.replace(/^www\./, ""))) {
      diagnostic.pagesSkipped += 1;
      continue;
    }
    seenSitemaps.add(loc);
    diagnostic.childSitemapsFound += 1;
    const child = await fetchPublicUrl(fetchImpl, loc, domain).catch(() => null);
    if (!child?.ok) {
      diagnostic.failures += 1;
      continue;
    }
    const parsed = parseSitemapXml(child.body);
    for (const entry of parsed) {
      if (entry.sitemap) {
        if (!seenSitemaps.has(entry.loc) && seenSitemaps.size + queue.length < WEBSITE_MAX_SITEMAPS) {
          queue.push(entry.loc);
        }
      } else {
        found.push(entry);
      }
    }
  }

  for (const policyUrl of shopifyPolicyUrls(origin)) {
    if (!found.some((entry) => entry.loc.replace(/\/$/, "") === policyUrl)) {
      found.push({ loc: policyUrl });
    }
  }

  diagnostic.urlsDiscovered = found.length;
  return found;
}

function selectIndexableUrls(
  domain: string,
  entries: { loc: string; lastmod?: string }[],
  diagnostic: WebsiteSyncDiagnostic,
) {
  const unique = new Map<string, { loc: string; lastmod?: string }>();
  for (const entry of entries) {
    if (!isSameRegisteredDomain(entry.loc, domain)) {
      diagnostic.pagesSkipped += 1;
      continue;
    }
    if (!shouldIndexWebsiteUrl(entry.loc)) {
      diagnostic.pagesSkipped += 1;
      continue;
    }
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
}): Promise<{
  pages: Omit<WebsitePageRecord, "id">[];
  conflictWarning: string | null;
  diagnostic: WebsiteSyncDiagnostic;
  error?: string;
}> {
  const now = input.now ?? new Date();
  const fetchImpl = input.fetchImpl ?? fetch;
  const origin = websiteOrigin(input.source.domain);
  const diagnostic = emptyWebsiteSyncDiagnostic();
  const sitemapEntries = await collectSitemapUrls(
    origin,
    input.source.domain,
    fetchImpl,
    diagnostic,
  );
  const selected = selectIndexableUrls(input.source.domain, sitemapEntries, diagnostic);
  if (!selected.length) {
    selected.push({ loc: `${origin}/` });
  }

  const pages: Omit<WebsitePageRecord, "id">[] = [];
  for (const entry of selected) {
    if (isPrivateOrUnsafeUrl(entry.loc)) {
      diagnostic.pagesSkipped += 1;
      continue;
    }
    const response = await fetchPublicUrl(fetchImpl, entry.loc, input.source.domain).catch(
      () => null,
    );
    if (!response) {
      diagnostic.failures += 1;
      continue;
    }
    if (!response.ok) {
      diagnostic.failures += 1;
      continue;
    }
    const finalUrl = response.url || entry.loc;
    if (!isSameRegisteredDomain(finalUrl, input.source.domain) || isPrivateOrUnsafeUrl(finalUrl)) {
      diagnostic.pagesSkipped += 1;
      continue;
    }
    const extracted = extractPageText(response.body);
    if (!extracted.text.trim()) {
      diagnostic.pagesSkipped += 1;
      continue;
    }
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

  diagnostic.pagesIndexed = pages.length;
  const asRecords = pages.map((page, index) => ({
    ...page,
    id: `tmp_${index}`,
  }));
  const warnings = detectWebsiteConflicts(asRecords);
  return {
    pages,
    conflictWarning: warnings[0] ?? null,
    diagnostic,
    error: pages.length
      ? undefined
      : `No public pages were indexed. ${formatWebsiteSyncDiagnostic(diagnostic)}`,
  };
}

export function nextWebsiteSyncAt(from: Date) {
  return new Date(from.getTime() + WEBSITE_SYNC_INTERVAL_MS);
}
