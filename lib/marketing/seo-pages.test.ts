import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SEO_ROUTES } from "./seo-routes";
import type { ResolvingMetadata } from "next";
import { SEO_PAGES, seoPageGenerateMetadata, seoPageJsonLd, seoPageMetadata } from "./seo-pages";
import { publicSitemapUrls, sitemapXml } from "./site";
import { BIZLYRO_PUBLIC_ORIGIN } from "@/lib/public-origin";

const FORBIDDEN = [
  "Start Free",
  "Start free",
  "free trial",
  "24/7 staff",
  "guaranteed sales",
  "Shopify is connected",
  "WooCommerce is connected",
];

function visibleText(page: (typeof SEO_PAGES)[number]) {
  return [
    page.title,
    page.description,
    page.h1,
    page.lede,
    ...page.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
    ...page.benefits.flatMap((item) => [item.title, item.body]),
    ...page.limits.flatMap((item) => [item.title, item.body]),
    ...page.steps.flatMap((item) => [item.title, item.body]),
    ...page.faqs.flatMap((item) => [item.question, item.answer]),
  ].join(" ");
}

describe("use-case landing pages", () => {
  it("publishes four unique indexable pages for the target intents", async () => {
    assert.deepEqual(
      SEO_ROUTES.map((route) => route.path),
      SEO_PAGES.map((page) => page.path),
    );
    assert.equal(new Set(SEO_PAGES.map((page) => page.title)).size, SEO_PAGES.length);
    assert.equal(new Set(SEO_PAGES.map((page) => page.description)).size, SEO_PAGES.length);
    assert.equal(new Set(SEO_PAGES.map((page) => page.h1)).size, SEO_PAGES.length);

    for (const page of SEO_PAGES) {
      const intent = page.intent.toLowerCase();
      assert.equal(page.label, page.intent);
      assert.match(page.title.toLowerCase(), new RegExp(intent));
      assert.match(page.description.toLowerCase(), new RegExp(intent));
      assert.match(page.h1.toLowerCase(), new RegExp(intent));
      assert.ok(page.description.length >= 120 && page.description.length <= 170, page.description);
      assert.ok(visibleText(page).split(/\s+/).length >= 400, page.path);

      const metadata = seoPageMetadata(page);
      const canonical = `${BIZLYRO_PUBLIC_ORIGIN}${page.path}`;
      assert.equal(metadata.title, page.title);
      assert.equal(metadata.description, page.description);
      assert.equal(
        metadata.alternates && "canonical" in metadata.alternates ? metadata.alternates.canonical : "",
        canonical,
      );
      assert.equal(metadata.openGraph && "url" in metadata.openGraph ? metadata.openGraph.url : "", canonical);
      assert.equal(metadata.openGraph && "title" in metadata.openGraph ? metadata.openGraph.title : "", page.title);
      assert.equal(
        metadata.openGraph && "description" in metadata.openGraph ? metadata.openGraph.description : "",
        page.description,
      );
      assert.equal(
        metadata.openGraph && "siteName" in metadata.openGraph ? metadata.openGraph.siteName : "",
        "Bizlyro AI",
      );
      assert.equal(metadata.twitter && "title" in metadata.twitter ? metadata.twitter.title : "", page.title);
      const robots = metadata.robots;
      assert.equal(!!robots && typeof robots === "object" && robots.index === true, true);
      assert.equal(!!robots && typeof robots === "object" && robots.follow === true, true);
      const inherited = [{ url: "https://bizlyro.com/opengraph-image", width: 1200, height: 630, alt: "Bizlyro AI" }];
      const withImages = await seoPageGenerateMetadata(
        page,
        Promise.resolve({ openGraph: { images: inherited } }) as ResolvingMetadata,
      );
      assert.deepEqual(withImages.openGraph && "images" in withImages.openGraph ? withImages.openGraph.images : null, inherited);
      assert.deepEqual(withImages.twitter && "images" in withImages.twitter ? withImages.twitter.images : null, inherited);

      const jsonLd = JSON.stringify(seoPageJsonLd(page));
      assert.match(jsonLd, /"@type":"WebPage"/);
      assert.match(jsonLd, /"@type":"BreadcrumbList"/);
      assert.match(jsonLd, /"@type":"FAQPage"/);
      assert.match(jsonLd, new RegExp(canonical.replaceAll("/", "\\/")));
      assert.doesNotMatch(jsonLd, /aggregateRating|ratingValue|"@type":"Review"|award/);
      for (const faq of page.faqs) {
        assert.match(jsonLd, new RegExp(faq.question.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      }

      const others = page.related.map((link) => link.href);
      const siblingLinks = SEO_PAGES.filter((item) => item.path !== page.path).filter((item) =>
        others.includes(item.path),
      );
      assert.ok(siblingLinks.length >= 2, page.path);
      assert.equal(page.faqs.length >= 3, true);
      assert.doesNotMatch(visibleText(page), /[★⭐]|4\.\d+\/5|as seen in|trusted by \d/i);
    }
  });

  it("adds the pages to the Bizlyro sitemap and the homepage", () => {
    const urls = publicSitemapUrls(BIZLYRO_PUBLIC_ORIGIN);
    const xml = sitemapXml(BIZLYRO_PUBLIC_ORIGIN);
    for (const route of SEO_ROUTES) {
      const url = `${BIZLYRO_PUBLIC_ORIGIN}${route.path}`;
      const entry = urls.find((item) => item.url === url);
      assert.ok(entry, url);
      assert.equal(entry.priority, 0.8);
      assert.equal(entry.lastModified.toISOString().slice(0, 10), "2026-10-06");
      assert.match(xml, new RegExp(`<loc>${url}</loc><lastmod>2026-10-06</lastmod>`));
      assert.match(readFileSync("lib/marketing/seo-routes.ts", "utf8"), new RegExp(route.path));
      const pageSource = readFileSync(`app${route.path}/page.tsx`, "utf8");
      assert.match(pageSource, new RegExp(`seoPageByPath\\("${route.path}"\\)`));
      assert.match(pageSource, /seoPageGenerateMetadata\(page, parent\)/);
    }
    const home = readFileSync("components/marketing-home.tsx", "utf8");
    const footer = readFileSync("components/site-footer.tsx", "utf8");
    assert.match(home, /SEO_ROUTES\.map/);
    assert.match(home, /href=\{route\.path\}/);
    assert.match(home, /<SectionGuide sectionId="product" \/>/);
    assert.match(home, /<SectionGuide sectionId=\{item\.id\} \/>/);
    assert.match(home, /<SectionGuide sectionId="widget" \/>/);
    assert.match(footer, /SEO_ROUTES\.map/);
    assert.match(footer, /href=\{route\.path\}/);
    assert.match(readFileSync("components/seo-landing.tsx", "utf8"), /<h1/);
    assert.equal(readFileSync("components/seo-landing.tsx", "utf8").split("<h1").length - 1, 1);
    assert.match(readFileSync("components/seo-landing.tsx", "utf8"), /href=\{LANDING_PRIMARY_CTA\.href\}/);
    for (const phrase of FORBIDDEN) {
      assert.equal(readFileSync("lib/marketing/seo-pages.ts", "utf8").includes(phrase), false, phrase);
    }
  });
});
