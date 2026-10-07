import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { ResolvingMetadata } from "next";
import { HOME_METADATA, LANDING_HERO } from "./copy";
import { SEO_PAGES } from "./seo-pages";
import { BIZLYRO_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { publicSitemapUrls, sitemapXml } from "./site";
import {
  PRODUCT_FAQS,
  PRODUCT_HONEST,
  PRODUCT_PAGE,
  PRODUCT_PAGE_PATH,
  productPageGenerateMetadata,
  productPageJsonLd,
  productPageMetadata,
} from "./product-page";

const FORBIDDEN = [
  "Start Free",
  "Start free",
  "free trial",
  "24/7 staff",
  "guaranteed sales",
  "Shopify is connected",
  "WooCommerce is connected",
];

describe("product launch page", () => {
  it("uses a unique indexable title, description, and canonical", async () => {
    const metadata = productPageMetadata();
    const url = `${BIZLYRO_PUBLIC_ORIGIN}${PRODUCT_PAGE_PATH}`;
    assert.notEqual(PRODUCT_PAGE.title, HOME_METADATA.title);
    assert.notEqual(PRODUCT_PAGE.description, HOME_METADATA.description);
    assert.notEqual(PRODUCT_PAGE.h1, LANDING_HERO.title);
    assert.equal(SEO_PAGES.some((page) => page.title === PRODUCT_PAGE.title), false);
    assert.equal(SEO_PAGES.some((page) => page.description === PRODUCT_PAGE.description), false);
    assert.equal(SEO_PAGES.some((page) => page.h1 === PRODUCT_PAGE.h1), false);
    assert.equal(metadata.title, PRODUCT_PAGE.title);
    assert.equal(metadata.description, PRODUCT_PAGE.description);
    assert.equal(metadata.alternates && "canonical" in metadata.alternates ? metadata.alternates.canonical : "", url);
    assert.equal(metadata.openGraph && "url" in metadata.openGraph ? metadata.openGraph.url : "", url);
    assert.equal(metadata.openGraph && "title" in metadata.openGraph ? metadata.openGraph.title : "", PRODUCT_PAGE.title);
    assert.equal(metadata.twitter && "card" in metadata.twitter ? metadata.twitter.card : "", "summary_large_image");
    assert.equal(metadata.twitter && "title" in metadata.twitter ? metadata.twitter.title : "", PRODUCT_PAGE.title);
    const robots = metadata.robots;
    assert.equal(!!robots && typeof robots === "object" && robots.index === true, true);
    assert.equal(!!robots && typeof robots === "object" && robots.follow === true, true);
    const inherited = [{ url: "https://bizlyro.com/opengraph-image", width: 1200, height: 630, alt: "Bizlyro AI" }];
    const withImages = await productPageGenerateMetadata(
      Promise.resolve({ openGraph: { images: inherited } }) as ResolvingMetadata,
    );
    assert.deepEqual(withImages.openGraph && "images" in withImages.openGraph ? withImages.openGraph.images : null, inherited);
    assert.deepEqual(withImages.twitter && "images" in withImages.twitter ? withImages.twitter.images : null, inherited);
  });

  it("stands alone without fake proof and stays on the Bizlyro sitemap only", () => {
    const source = [
      readFileSync("lib/marketing/product-page.ts", "utf8"),
      readFileSync("components/product-launch.tsx", "utf8"),
      readFileSync("app/product/page.tsx", "utf8"),
    ].join("\n");
    for (const phrase of FORBIDDEN) assert.equal(source.includes(phrase), false, phrase);
    assert.doesNotMatch(source, /BizPilot/);
    assert.doesNotMatch(source, /[★⭐]|4\.\d+\/5|as seen in|trusted by \d|testimonial|award/i);
    assert.match(source, /\$29\.99/);
    assert.match(source, /24\/7/);
    assert.match(PRODUCT_HONEST, /never invents unknown prices, policies, promotions, or business facts/i);
    assert.match(readFileSync("components/site-footer.tsx", "utf8"), /href="\/product"/);
    const visible = [
      PRODUCT_PAGE.h1,
      PRODUCT_PAGE.lede,
      ...PRODUCT_FAQS.flatMap((faq) => [faq.question, faq.answer]),
    ].join(" ");
    assert.ok(visible.split(/\s+/).length >= 80);
    const bizlyro = publicSitemapUrls(BIZLYRO_PUBLIC_ORIGIN).map((entry) => entry.url);
    assert.equal(bizlyro.includes(`${BIZLYRO_PUBLIC_ORIGIN}/product`), true);
    assert.match(sitemapXml(BIZLYRO_PUBLIC_ORIGIN), /<loc>https:\/\/bizlyro\.com\/product<\/loc><lastmod>2026-10-07<\/lastmod>/);
    assert.equal(publicSitemapUrls().some((entry) => entry.url.endsWith("/product")), false);
    const jsonLd = JSON.stringify(productPageJsonLd());
    assert.match(jsonLd, /"@type":"WebPage"/);
    assert.match(jsonLd, /"@type":"FAQPage"/);
    assert.match(jsonLd, /"price":"29.99"/);
    assert.doesNotMatch(jsonLd, /aggregateRating|ratingValue|"@type":"Review"|award|founder|sameAs/);
  });
});
