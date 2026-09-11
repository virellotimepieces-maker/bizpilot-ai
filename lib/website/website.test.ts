import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groundedWebsiteAnswer, WEBSITE_NO_SOURCE_ANSWER } from "./answer";
import { detectWebsiteConflicts, preferOfficialPages } from "./conflicts";
import { extractPageText } from "./extract";
import { retrieveRelevantPages } from "./retrieve";
import { parseSitemapXml } from "./sitemap";
import { crawlWebsitePages } from "./sync";
import type { WebsitePageRecord, WebsiteSourceRecord } from "./types";
import {
  classifyWebsitePage,
  isPrivateOrUnsafeUrl,
  normalizeWebsiteDomain,
  shouldIndexWebsiteUrl,
} from "./urls";
import { homepageHasWidgetSnippet } from "./verify";

function page(partial: Partial<WebsitePageRecord> & Pick<WebsitePageRecord, "workspaceId" | "widgetKey" | "url" | "content">): WebsitePageRecord {
  return {
    id: partial.id ?? partial.url,
    sourceId: partial.sourceId ?? "src",
    title: partial.title ?? "Page",
    kind: partial.kind ?? classifyWebsitePage(partial.url, partial.title),
    contentHash: partial.contentHash ?? "h",
    lastModified: partial.lastModified ?? null,
    fetchedAt: partial.fetchedAt ?? new Date("2026-01-01T00:00:00Z"),
    ...partial,
  };
}

describe("website ingestion guards", () => {
  it("normalizes domains and skips checkout, cart, account, admin, and private URLs", () => {
    assert.equal(normalizeWebsiteDomain("https://WWW.HarborAndPine.com/pages/about"), "harborandpine.com");
    assert.equal(isPrivateOrUnsafeUrl("https://shop.com/cart"), true);
    assert.equal(isPrivateOrUnsafeUrl("https://shop.com/checkout"), true);
    assert.equal(isPrivateOrUnsafeUrl("https://shop.com/account/login"), true);
    assert.equal(isPrivateOrUnsafeUrl("https://shop.com/admin"), true);
    assert.equal(isPrivateOrUnsafeUrl("https://shop.com/checkouts/cn/abc"), true);
    assert.equal(shouldIndexWebsiteUrl("https://shop.com/products/linen-duvet"), true);
    assert.equal(shouldIndexWebsiteUrl("https://shop.com/collections/mens-watches"), true);
    assert.equal(shouldIndexWebsiteUrl("https://shop.com/blogs/news/how-to-choose"), true);
    assert.equal(shouldIndexWebsiteUrl("https://shop.com/search"), false);
    assert.equal(isPrivateOrUnsafeUrl("https://shop.com/search"), true);
    assert.equal(isPrivateOrUnsafeUrl("https://shop.com/?preview_theme_id=123"), true);
    assert.equal(shouldIndexWebsiteUrl("https://shop.com/cart"), false);
    assert.equal(classifyWebsitePage("https://shop.com/policies/shipping-policy"), "shipping");
  });

  it("parses a Shopify sitemap index and product/policy URLs", () => {
    const index = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://shop.example/sitemap_products_1.xml</loc></sitemap><sitemap><loc>https://shop.example/sitemap_pages_1.xml</loc></sitemap></sitemapindex>`;
    const parsed = parseSitemapXml(index);
    assert.equal(parsed.length, 2);
    assert.equal(parsed[0]?.sitemap, true);
    const products = parseSitemapXml(
      `<urlset><url><loc>https://shop.example/products/stonewash-duvet</loc><lastmod>2026-09-01</lastmod></url><url><loc>https://shop.example/cart</loc></url></urlset>`,
    );
    assert.equal(products[0]?.loc, "https://shop.example/products/stonewash-duvet");
    assert.ok(
      homepageHasWidgetSnippet(
        '<script src="https://bizpilot-ai-mocha.vercel.app/w/bpw_live.js?v=0c6fa93"></script>',
        "bpw_live",
      ),
    );
  });

  it("extracts visible page text and ignores scripts", () => {
    const extracted = extractPageText(
      `<html><title>Refund policy</title><script>secret()</script><body><p>Returns are accepted within 30 days.</p></body></html>`,
    );
    assert.equal(extracted.title, "Refund policy");
    assert.match(extracted.text, /Returns are accepted within 30 days/);
    assert.doesNotMatch(extracted.text, /secret/);
  });
});

describe("website tenant isolation and answering", () => {
  it("never uses another subscriber’s indexed pages in an answer", () => {
    const pine = page({
      workspaceId: "ws_pine",
      widgetKey: "bpw_pine",
      url: "https://pine.example/policies/shipping-policy",
      title: "Shipping",
      kind: "shipping",
      content: "Harbor & Pine ships in 2 business days with free tracking.",
    });
    const rival = page({
      workspaceId: "ws_rival",
      widgetKey: "bpw_rival",
      url: "https://rival.example/policies/shipping-policy",
      title: "Shipping",
      kind: "shipping",
      content: "Rival Co ships in 9 business days and never offers tracking.",
    });
    const mixed = [pine, rival];
    const answer = groundedWebsiteAnswer({
      question: "How fast is shipping?",
      pages: mixed,
      workspaceId: "ws_pine",
      widgetKey: "bpw_pine",
    });
    assert.match(answer.answer, /2 business days/);
    assert.doesNotMatch(answer.answer, /9 business days|Rival/);
    assert.deepEqual(
      answer.sources.map((row) => row.url),
      ["https://pine.example/policies/shipping-policy"],
    );
    const leaked = retrieveRelevantPages(mixed, "shipping").filter(
      (row) => row.workspaceId !== "ws_pine",
    );
    const scoped = groundedWebsiteAnswer({
      question: "shipping",
      pages: mixed.filter((row) => row.workspaceId === "ws_pine" && row.widgetKey === "bpw_pine"),
      workspaceId: "ws_pine",
      widgetKey: "bpw_pine",
    });
    assert.equal(scoped.sources.some((row) => row.url.includes("rival")), false);
    assert.equal(leaked.length, 1);
  });

  it("does not invent an answer when no reliable page exists", () => {
    const result = groundedWebsiteAnswer({
      question: "Do you offer lifetime gold plating?",
      pages: [
        page({
          workspaceId: "ws_pine",
          widgetKey: "bpw_pine",
          url: "https://pine.example/pages/about",
          kind: "about",
          content: "We sell washed linen bedding from a small studio.",
        }),
      ],
      workspaceId: "ws_pine",
      widgetKey: "bpw_pine",
    });
    assert.equal(result.answer, WEBSITE_NO_SOURCE_ANSWER);
    assert.equal(result.sources.length, 0);
  });

  it("prefers the newest official page when two policy pages conflict", () => {
    const older = page({
      workspaceId: "ws",
      widgetKey: "bpw",
      url: "https://shop.example/pages/old-shipping",
      kind: "shipping",
      content: "We only offer pickup. No courier shipping is available at all.",
      lastModified: new Date("2024-01-01T00:00:00Z"),
    });
    const newest = page({
      workspaceId: "ws",
      widgetKey: "bpw",
      url: "https://shop.example/policies/shipping-policy",
      kind: "shipping",
      content: "We ship worldwide in 3–5 days with tracked courier service.",
      lastModified: new Date("2026-09-01T00:00:00Z"),
    });
    const preferred = preferOfficialPages([older, newest], "shipping")[0];
    assert.equal(preferred?.url, newest.url);
    const warnings = detectWebsiteConflicts([older, newest]);
    assert.match(warnings.join(" "), /preferring https:\/\/shop.example\/policies\/shipping-policy/);
  });
});

describe("website crawl uses sitemap and skips private paths", () => {
  it("indexes Shopify product and policy pages from the public sitemap only", async () => {
    const source: WebsiteSourceRecord = {
      id: "src1",
      workspaceId: "ws_pine",
      widgetKey: "bpw_pine",
      domain: "pine.example",
      verifyToken: "bpv_test",
      verifiedAt: new Date(),
      lastSyncAt: null,
      nextSyncAt: null,
      lastSyncStatus: "idle",
      lastSyncError: null,
      lastSyncDiagnostic: null,
      lastSyncPageCount: 0,
      conflictWarning: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const files: Record<string, string> = {
      "https://pine.example/sitemap.xml": `<sitemapindex><sitemap><loc>https://pine.example/sitemap_products_1.xml</loc></sitemap><sitemap><loc>https://pine.example/sitemap_pages_1.xml</loc></sitemap></sitemapindex>`,
      "https://pine.example/sitemap_products_1.xml": `<urlset><url><loc>https://pine.example/products/duvet</loc></url><url><loc>https://pine.example/cart</loc></url><url><loc>https://pine.example/checkout</loc></url></urlset>`,
      "https://pine.example/sitemap_pages_1.xml": `<urlset><url><loc>https://pine.example/policies/shipping-policy</loc></url><url><loc>https://pine.example/account</loc></url></urlset>`,
      "https://pine.example/products/duvet": `<html><title>Stonewash duvet</title><body>Washed linen duvet, $168.</body></html>`,
      "https://pine.example/policies/shipping-policy": `<html><title>Shipping</title><body>Ships in 2 days.</body></html>`,
    };
    const result = await crawlWebsitePages({
      source,
      fetchImpl: async (url) => {
        const body = files[url];
        return {
          ok: Boolean(body),
          status: body ? 200 : 404,
          url,
          headers: { get: () => null },
          text: async () => body ?? "",
        };
      },
    });
    const urls = result.pages.map((row) => row.url).sort();
    assert.deepEqual(urls, [
      "https://pine.example/policies/shipping-policy",
      "https://pine.example/products/duvet",
    ]);
    assert.equal(
      result.pages.every((row) => row.workspaceId === "ws_pine" && row.widgetKey === "bpw_pine"),
      true,
    );
  });
});
