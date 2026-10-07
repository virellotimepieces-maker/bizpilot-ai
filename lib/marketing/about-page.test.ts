import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { ResolvingMetadata } from "next";
import { HOME_METADATA, LANDING_HERO } from "./copy";
import { PRODUCT_PAGE } from "./product-page";
import { SEO_PAGES } from "./seo-pages";
import { BIZLYRO_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { publicSitemapUrls, sitemapXml } from "./site";
import {
  ABOUT_HONEST,
  ABOUT_PAGE,
  ABOUT_PAGE_PATH,
  ABOUT_WHY,
  aboutPageGenerateMetadata,
  aboutPageJsonLd,
  aboutPageMetadata,
} from "./about-page";

const FORBIDDEN = [
  "Start Free",
  "Start free",
  "free trial",
  "24/7 staff",
  "guaranteed sales",
  "Shopify is connected",
  "WooCommerce is connected",
];

const POST_SECTIONS = [
  "Launch announcement",
  "Product story",
  "Feature spotlight",
  "Honest AI",
  "Small-business use case",
];

describe("about page", () => {
  it("uses a unique indexable title, description, and canonical", async () => {
    const metadata = aboutPageMetadata();
    const url = `${BIZLYRO_PUBLIC_ORIGIN}${ABOUT_PAGE_PATH}`;
    assert.notEqual(ABOUT_PAGE.title, HOME_METADATA.title);
    assert.notEqual(ABOUT_PAGE.title, PRODUCT_PAGE.title);
    assert.notEqual(ABOUT_PAGE.description, HOME_METADATA.description);
    assert.notEqual(ABOUT_PAGE.description, PRODUCT_PAGE.description);
    assert.notEqual(ABOUT_PAGE.h1, LANDING_HERO.title);
    assert.notEqual(ABOUT_PAGE.h1, PRODUCT_PAGE.h1);
    assert.equal(SEO_PAGES.some((page) => page.title === ABOUT_PAGE.title), false);
    assert.equal(SEO_PAGES.some((page) => page.description === ABOUT_PAGE.description), false);
    assert.equal(SEO_PAGES.some((page) => page.h1 === ABOUT_PAGE.h1), false);
    assert.equal(metadata.title, ABOUT_PAGE.title);
    assert.equal(metadata.description, ABOUT_PAGE.description);
    assert.equal(metadata.alternates && "canonical" in metadata.alternates ? metadata.alternates.canonical : "", url);
    assert.equal(metadata.openGraph && "url" in metadata.openGraph ? metadata.openGraph.url : "", url);
    assert.equal(metadata.twitter && "card" in metadata.twitter ? metadata.twitter.card : "", "summary_large_image");
    const robots = metadata.robots;
    assert.equal(!!robots && typeof robots === "object" && robots.index === true, true);
    assert.equal(!!robots && typeof robots === "object" && robots.follow === true, true);
    const inherited = [{ url: "https://bizlyro.com/opengraph-image", width: 1200, height: 630, alt: "Bizlyro AI" }];
    const withImages = await aboutPageGenerateMetadata(
      Promise.resolve({ openGraph: { images: inherited } }) as ResolvingMetadata,
    );
    assert.deepEqual(withImages.openGraph && "images" in withImages.openGraph ? withImages.openGraph.images : null, inherited);
  });

  it("explains the product, Why Bizlyro, and the real price without fake proof", () => {
    const source = [
      readFileSync("lib/marketing/about-page.ts", "utf8"),
      readFileSync("components/about-bizlyro.tsx", "utf8"),
      readFileSync("app/about/page.tsx", "utf8"),
    ].join("\n");
    for (const phrase of FORBIDDEN) assert.equal(source.includes(phrase), false, phrase);
    assert.doesNotMatch(source, /BizPilot/);
    assert.doesNotMatch(source, /[★⭐]|4\.\d+\/5|as seen in|trusted by \d|testimonial|award/i);
    assert.match(source, /\$29\.99/);
    assert.match(source, /24\/7/);
    assert.match(source, /Why Bizlyro/);
    assert.match(source, /Lead/);
    assert.match(ABOUT_HONEST, /should not invent business facts, prices, policies, or availability/i);
    assert.equal(ABOUT_WHY.length, 4);
    assert.match(ABOUT_WHY.map((item) => item.title).join(" "), /does not invent missing business information/i);
    assert.match(ABOUT_WHY.map((item) => item.body).join(" "), /unavailable/i);
    assert.match(ABOUT_WHY.map((item) => item.body).join(" "), /website you already have/i);
    assert.match(ABOUT_WHY.map((item) => item.body).join(" "), /review the conversations and leads/i);
    assert.match(readFileSync("components/site-footer.tsx", "utf8"), /href="\/about"/);
    const bizlyro = publicSitemapUrls(BIZLYRO_PUBLIC_ORIGIN).map((entry) => entry.url);
    assert.equal(bizlyro.includes(`${BIZLYRO_PUBLIC_ORIGIN}/about`), true);
    assert.match(sitemapXml(BIZLYRO_PUBLIC_ORIGIN), /<loc>https:\/\/bizlyro\.com\/about<\/loc><lastmod>2026-10-07<\/lastmod>/);
    assert.equal(publicSitemapUrls().some((entry) => entry.url.endsWith("/about")), false);
    const jsonLd = JSON.stringify(aboutPageJsonLd());
    assert.match(jsonLd, /AboutPage/);
    assert.match(jsonLd, /29\.99/);
    assert.doesNotMatch(jsonLd, /aggregateRating|review/i);
  });
});

describe("build in public pack", () => {
  it("gives each network a post for each story, and every post links to bizlyro.com", () => {
    const pack = readFileSync("docs/launch/build-in-public.md", "utf8");
    for (const phrase of FORBIDDEN) assert.equal(pack.includes(phrase), false, phrase);
    assert.doesNotMatch(pack, /BizPilot/);
    assert.doesNotMatch(pack, /[★⭐]|4\.\d+\/5|as seen in|trusted by \d|Shopify is connected|WooCommerce is connected/i);
    for (const section of POST_SECTIONS) assert.match(pack, new RegExp(`## ${section}`));
    for (const network of ["### LinkedIn", "### X", "### Reddit", "### Facebook"]) {
      assert.equal(pack.split(network).length - 1, POST_SECTIONS.length, network);
    }
    const posts = pack.split(/^### /m).slice(1);
    assert.equal(posts.length, POST_SECTIONS.length * 4);
    for (const post of posts) {
      assert.match(post, /https:\/\/bizlyro\.com/);
      assert.doesNotMatch(post, /https:\/\/(?!bizlyro\.com)/);
    }
  });
});
