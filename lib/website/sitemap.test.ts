import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { describe, it } from "node:test";
import { MemoryBillingStore } from "../billing/memory-store";
import { decodeFetchedBody } from "./fetch-public";
import { runWebsiteSync } from "./run-sync";
import { parseSitemapXml, shopifyPolicyUrls } from "./sitemap";
import { crawlWebsitePages, formatWebsiteSyncDiagnostic } from "./sync";
import type { WebsiteSourceRecord } from "./types";
import type { WebsiteFetchLike } from "./verify";

const DOMAIN = "virellotimepieces.com";
const ORIGIN = `https://${DOMAIN}`;
const KEY = "bpw_shop_widget";

function source(partial: Partial<WebsiteSourceRecord> = {}): WebsiteSourceRecord {
  return {
    id: "src_shop",
    workspaceId: "ws_shop",
    widgetKey: KEY,
    domain: DOMAIN,
    verifyToken: "bpv_shop",
    verifiedAt: new Date("2026-09-11T00:00:00Z"),
    lastSyncAt: null,
    nextSyncAt: null,
    lastSyncStatus: "idle",
    lastSyncError: null,
    lastSyncDiagnostic: null,
    lastSyncPageCount: 0,
    conflictWarning: null,
    createdAt: new Date("2026-09-11T00:00:00Z"),
    updatedAt: new Date("2026-09-11T00:00:00Z"),
    ...partial,
  };
}

function html(title: string, body: string) {
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${body}"></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;
}

function mockFetch(
  routes: Record<
    string,
    { status?: number; body?: string | Buffer; location?: string; url?: string }
  >,
): WebsiteFetchLike {
  return async (url) => {
    const route = routes[url];
    if (!route) {
      return {
        ok: false,
        status: 404,
        url,
        headers: { get: () => null },
        text: async () => "",
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }
    const status = route.status ?? 200;
    const raw = route.body ?? "";
    const bytes = typeof raw === "string" ? Buffer.from(raw) : raw;
    return {
      ok: status >= 200 && status < 300,
      status,
      url: route.url ?? url,
      headers: {
        get: (name) => (name.toLowerCase() === "location" ? route.location ?? null : null),
      },
      text: async () => bytes.toString("utf8"),
        arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    };
  };
}

describe("Shopify sitemap XML parsing", () => {
  it("parses namespaced sitemap indexes and child urlsets, including query parameters", () => {
    const index = `<?xml version="1.0" encoding="UTF-8"?>
<sm:sitemapindex xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sm:sitemap>
    <sm:loc>https://virellotimepieces.com/sitemap_products_1.xml?from=1&amp;to=2</sm:loc>
  </sm:sitemap>
  <sm:sitemap>
    <sm:loc>https://virellotimepieces.com/sitemap_collections_1.xml</sm:loc>
  </sm:sitemap>
</sm:sitemapindex>`;
    const parsed = parseSitemapXml(index);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.sitemap, true);
    assert.equal(
      parsed[0]?.loc,
      "https://virellotimepieces.com/sitemap_products_1.xml?from=1&to=2",
    );

    const products = parseSitemapXml(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>https://virellotimepieces.com/products/pagani-design-pd1644</loc>
    <lastmod>2026-09-11T14:35:34-04:00</lastmod>
    <image:image>
      <image:loc>https://cdn.shopify.com/s/files/product.jpg</image:loc>
      <image:title>Watch</image:title>
    </image:image>
  </url>
</urlset>`);
    assert.equal(products.length, 1);
    assert.equal(products[0]?.loc, "https://virellotimepieces.com/products/pagani-design-pd1644");
    assert.doesNotMatch(products[0]?.loc ?? "", /cdn\.shopify\.com/);
  });

  it("decodes gzip sitemap bodies", () => {
    const xml = `<urlset><url><loc>https://virellotimepieces.com/products/watch</loc></url></urlset>`;
    const decoded = decodeFetchedBody(gzipSync(xml));
    assert.match(decoded, /products\/watch/);
    assert.equal(parseSitemapXml(decoded)[0]?.loc, "https://virellotimepieces.com/products/watch");
  });
});

describe("Shopify website crawl", () => {
  it("recursively reads a Shopify sitemap index and child sitemaps, including policy URLs", async () => {
    const productLoc = `${ORIGIN}/sitemap_products_1.xml?from=10364778610995&to=10391961829683`;
    const pagesLoc = `${ORIGIN}/sitemap_pages_1.xml?from=159410618675&to=160007651635`;
    const collectionsLoc = `${ORIGIN}/sitemap_collections_1.xml?from=509112484147&to=510346068275`;
    const blogsLoc = `${ORIGIN}/sitemap_blogs_1.xml`;
    const nestedLoc = `${ORIGIN}/sitemap_nested_index.xml`;
    const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${ORIGIN}/sitemap_agentic_discovery.xml</loc></sitemap>
  <sitemap><loc>${ORIGIN}/sitemap_products_1.xml?from=10364778610995&amp;to=10391961829683</loc></sitemap>
  <sitemap><loc>${ORIGIN}/sitemap_pages_1.xml?from=159410618675&amp;to=160007651635</loc></sitemap>
  <sitemap><loc>${ORIGIN}/sitemap_collections_1.xml?from=509112484147&amp;to=510346068275</loc></sitemap>
  <sitemap><loc>${ORIGIN}/sitemap_blogs_1.xml</loc></sitemap>
  <sitemap><loc>${nestedLoc}</loc></sitemap>
</sitemapindex>`;

    const routes: Record<string, { status?: number; body?: string | Buffer; location?: string; url?: string }> = {
      [`${ORIGIN}/sitemap.xml`]: { status: 301, location: `https://www.${DOMAIN}/sitemap.xml` },
      [`https://www.${DOMAIN}/sitemap.xml`]: { status: 200, body: index, url: `${ORIGIN}/sitemap.xml` },
      [`${ORIGIN}/sitemap_agentic_discovery.xml`]: {
        status: 200,
        body: `<urlset><url><loc>${ORIGIN}/agents.md</loc></url></urlset>`,
      },
      [productLoc]: {
        status: 200,
        body: gzipSync(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"><url><loc>${ORIGIN}/</loc></url><url><loc>${ORIGIN}/products/pagani-design-pd1644</loc><lastmod>2026-09-11T14:35:34-04:00</lastmod><image:image><image:loc>https://cdn.shopify.com/x.jpg</image:loc></image:image></url></urlset>`),
      },
      [pagesLoc]: {
        status: 200,
        body: `<urlset><url><loc>${ORIGIN}/pages/about-us</loc></url><url><loc>${ORIGIN}/pages/faq</loc></url><url><loc>${ORIGIN}/account</loc></url></urlset>`,
      },
      [collectionsLoc]: {
        status: 200,
        body: `<urlset><url><loc>${ORIGIN}/collections/mens-watches</loc></url></urlset>`,
      },
      [blogsLoc]: {
        status: 200,
        body: `<urlset><url><loc>${ORIGIN}/blogs/news/how-to-choose-the-perfect-luxury-watch</loc></url></urlset>`,
      },
      [nestedLoc]: {
        status: 200,
        body: `<sitemapindex><sitemap><loc>${ORIGIN}/sitemap_pages_extra.xml</loc></sitemap></sitemapindex>`,
      },
      [`${ORIGIN}/sitemap_pages_extra.xml`]: {
        status: 200,
        body: `<urlset><url><loc>${ORIGIN}/pages/contact</loc></url></urlset>`,
      },
      [`${ORIGIN}/`]: { status: 200, body: html("Virello Timepieces", "Official store homepage.") },
      [`${ORIGIN}/products/pagani-design-pd1644`]: {
        status: 200,
        body: html("Pagani Design PD1644", "Quartz chronograph with sapphire glass."),
      },
      [`${ORIGIN}/pages/about-us`]: { status: 200, body: html("About us", "We sell watches.") },
      [`${ORIGIN}/pages/faq`]: { status: 200, body: html("FAQ", "How to choose a watch.") },
      [`${ORIGIN}/pages/contact`]: { status: 200, body: html("Contact", "Email support@virellotimepieces.com") },
      [`${ORIGIN}/collections/mens-watches`]: {
        status: 200,
        body: html("Mens watches", "Automatic and quartz watches."),
      },
      [`${ORIGIN}/blogs/news/how-to-choose-the-perfect-luxury-watch`]: {
        status: 200,
        body: html("How to choose", "Look at movement, size, and bracelet."),
      },
      [`${ORIGIN}/cart`]: { status: 200, body: html("Cart", "Checkout now") },
      [`${ORIGIN}/search`]: { status: 200, body: html("Search", "Find a watch") },
    };
    for (const policy of shopifyPolicyUrls(ORIGIN)) {
      routes[policy] = {
        status: 200,
        body: html(policy.split("/").at(-1) ?? "Policy", "Public Shopify policy text for customers."),
      };
    }

    const result = await crawlWebsitePages({
      source: source(),
      fetchImpl: mockFetch(routes),
    });
    const urls = result.pages.map((row) => row.url).sort();
    assert.ok(urls.includes(`${ORIGIN}/products/pagani-design-pd1644`));
    assert.ok(urls.includes(`${ORIGIN}/collections/mens-watches`));
    assert.ok(urls.includes(`${ORIGIN}/pages/about-us`));
    assert.ok(urls.includes(`${ORIGIN}/blogs/news/how-to-choose-the-perfect-luxury-watch`));
    assert.ok(urls.includes(`${ORIGIN}/policies/refund-policy`));
    assert.ok(urls.includes(`${ORIGIN}/policies/shipping-policy`));
    assert.ok(urls.includes(`${ORIGIN}/policies/privacy-policy`));
    assert.ok(urls.includes(`${ORIGIN}/policies/terms-of-service`));
    assert.ok(urls.includes(`${ORIGIN}/policies/contact-information`));
    assert.equal(urls.some((url) => url.includes("/cart")), false);
    assert.equal(urls.some((url) => url.includes("/account")), false);
    assert.equal(urls.some((url) => url.includes("/search")), false);
    assert.equal(urls.some((url) => url.includes("agents.md")), false);
    assert.equal(
      result.pages.every((row) => row.workspaceId === "ws_shop" && row.widgetKey === KEY),
      true,
    );
    assert.ok(result.pages.every((row) => row.title && row.content && row.url));
    assert.ok(result.diagnostic.childSitemapsFound >= 5);
    assert.ok(result.diagnostic.urlsDiscovered > 8);
    assert.ok(result.diagnostic.pagesIndexed >= 8);
    assert.match(formatWebsiteSyncDiagnostic(result.diagnostic), /Sitemap fetched:/);
    assert.match(formatWebsiteSyncDiagnostic(result.diagnostic), /Child sitemaps found:/);
    assert.match(formatWebsiteSyncDiagnostic(result.diagnostic), /URLs discovered:/);
    assert.match(formatWebsiteSyncDiagnostic(result.diagnostic), /Pages indexed:/);
    assert.match(formatWebsiteSyncDiagnostic(result.diagnostic), /Pages skipped:/);
    assert.match(formatWebsiteSyncDiagnostic(result.diagnostic), /Failures:/);
  });

  it("does not report a successful sync when 0 pages are indexed", async () => {
    const store = new MemoryBillingStore();
    const user = await store.createUser({
      email: "owner@example.com",
      passwordHash: "hash",
      name: "Owner",
    });
    const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Shop" });
    const savedSource = await store.upsertWebsiteSource({
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      domain: DOMAIN,
      verifyToken: "bpv_shop",
    });
    await store.saveWebsiteSource({ ...savedSource, verifiedAt: new Date() });
    const prior = await store.replaceWebsitePages(
      workspace.id,
      workspace.widgetKey,
      savedSource.id,
      [
        {
          url: `${ORIGIN}/policies/shipping-policy`,
          title: "Shipping",
          kind: "shipping",
          content: "Ships in 2 days.",
          contentHash: "h",
          lastModified: new Date("2026-09-01T00:00:00Z"),
          fetchedAt: new Date("2026-09-01T00:00:00Z"),
        },
      ],
    );
    const result = await runWebsiteSync({
      store,
      source: { ...savedSource, widgetKey: workspace.widgetKey, verifiedAt: new Date() },
      fetchImpl: mockFetch({}),
    });
    assert.equal(result.lastSyncStatus, "error");
    assert.equal(result.lastSyncPageCount, 0);
    assert.match(result.lastSyncError ?? "", /No public pages were indexed/);
    assert.match(result.lastSyncDiagnostic ?? "", /Sitemap fetched:/);
    const kept = await store.listWebsitePages(workspace.id, workspace.widgetKey);
    assert.equal(kept.length, prior.length);
    assert.equal(kept[0]?.url, `${ORIGIN}/policies/shipping-policy`);
  });
});
