export type SitemapEntry = {
  loc: string;
  lastmod?: string;
  sitemap?: boolean;
};

function decodeLoc(value: string) {
  return value
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

export function parseSitemapXml(xml: string): SitemapEntry[] {
  const source = xml.replace(/<\?xml[\s\S]*?\?>/i, "");
  const isIndex = /<sitemapindex[\s>]/i.test(source);
  if (isIndex) {
    const locs = [...source.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) =>
      decodeLoc(match[1] ?? ""),
    );
    return locs.filter(Boolean).map((loc) => ({ loc, sitemap: true }));
  }

  const chunks = source.split(/<url[\s>]/i).slice(1);
  const entries: SitemapEntry[] = [];
  for (const chunk of chunks) {
    const loc = chunk.match(/<loc>\s*([^<]+)\s*<\/loc>/i)?.[1];
    if (!loc) continue;
    const lastmod = chunk.match(/<lastmod>\s*([^<]+)\s*<\/lastmod>/i)?.[1];
    entries.push({ loc: decodeLoc(loc), lastmod: lastmod ? decodeLoc(lastmod) : undefined });
  }
  if (entries.length) return entries;

  return [...source.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => decodeLoc(match[1] ?? ""))
    .filter(Boolean)
    .map((loc) => ({ loc }));
}

export function sitemapCandidates(origin: string) {
  const base = origin.replace(/\/$/, "");
  return [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`];
}
