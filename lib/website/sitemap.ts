export type SitemapEntry = {
  loc: string;
  lastmod?: string;
  sitemap?: boolean;
};

export const SHOPIFY_POLICY_PATHS = [
  "/policies/refund-policy",
  "/policies/shipping-policy",
  "/policies/privacy-policy",
  "/policies/terms-of-service",
  "/policies/contact-information",
] as const;

function decodeLoc(value: string) {
  return value
    .trim()
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function extractBlocks(xml: string, localName: string) {
  const re = new RegExp(
    `<(?:[\\w.-]+:)?${localName}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${localName}>`,
    "gi",
  );
  return [...xml.matchAll(re)].map((match) => match[1] ?? "");
}

function extractPageLoc(chunk: string) {
  const match = chunk.match(
    /<(?!image:)(?:[\w.-]+:)?loc>\s*([^<]+)\s*<\/(?!image:)(?:[\w.-]+:)?loc>/i,
  );
  return match?.[1] ? decodeLoc(match[1]) : "";
}

function extractLastmod(chunk: string) {
  const match = chunk.match(/<(?:[\w.-]+:)?lastmod>\s*([^<]+)\s*<\/(?:[\w.-]+:)?lastmod>/i);
  return match?.[1] ? decodeLoc(match[1]) : undefined;
}

export function isSitemapIndexXml(xml: string) {
  return /<(?:[\w.-]+:)?sitemapindex[\s>]/i.test(xml);
}

export function parseSitemapXml(xml: string): SitemapEntry[] {
  const source = xml.replace(/^\uFEFF/, "").replace(/<\?xml[\s\S]*?\?>/i, "");
  if (isSitemapIndexXml(source)) {
    return extractBlocks(source, "sitemap").flatMap((block) => {
      const loc = extractPageLoc(block);
      return loc ? [{ loc, lastmod: extractLastmod(block), sitemap: true as const }] : [];
    });
  }

  const urlBlocks = extractBlocks(source, "url");
  if (urlBlocks.length) {
    return urlBlocks.flatMap((block) => {
      const loc = extractPageLoc(block);
      return loc ? [{ loc, lastmod: extractLastmod(block) }] : [];
    });
  }

  return [...source.matchAll(/<(?!image:)(?:[\w.-]+:)?loc>\s*([^<]+)\s*<\/(?!image:)(?:[\w.-]+:)?loc>/gi)]
    .map((match) => decodeLoc(match[1] ?? ""))
    .filter(Boolean)
    .map((loc) => ({ loc }));
}

export function sitemapCandidates(origin: string) {
  const base = origin.replace(/\/$/, "");
  const host = (() => {
    try {
      return new URL(base).host.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const urls = [
    `${base}/sitemap.xml`,
    `${base}/sitemap.xml.gz`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap_index.xml.gz`,
  ];
  if (host && !/^www\./i.test(new URL(base).host)) {
    urls.push(
      `https://www.${host}/sitemap.xml`,
      `https://www.${host}/sitemap.xml.gz`,
    );
  }
  return [...new Set(urls)];
}

export function shopifyPolicyUrls(origin: string) {
  const base = origin.replace(/\/$/, "");
  return SHOPIFY_POLICY_PATHS.map((path) => `${base}${path}`);
}
