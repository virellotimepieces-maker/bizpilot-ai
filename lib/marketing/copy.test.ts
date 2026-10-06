import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  FAQ_ITEMS,
  formatPlanPriceUsd,
  HOME_METADATA,
  INTEGRATION_ITEMS,
  LANDING_DEMO,
  LANDING_HERO,
  LANDING_NAV,
  LANDING_PRIMARY_CTA,
  LANDING_SECONDARY_CTA,
  LANDING_SECTIONS,
  PRICING_FEATURES,
  PRODUCT_PREVIEW_LABEL,
} from "./copy";
import { BIZPILOT_PRO } from "@/lib/plan";
import { homeMetadata, marketingRobots, publicSitemapUrls, sitemapXml } from "./site";
import { BIZLYRO_PUBLIC_ORIGIN, PRODUCTION_PUBLIC_ORIGIN } from "@/lib/public-origin";

const FORBIDDEN = [
  "Start Free",
  "Start free",
  "free trial",
  "24/7 staff",
  "guaranteed sales",
  "Shopify is connected",
  "WooCommerce is connected",
];

const LANDING_FILES = [
  "lib/marketing/copy.ts",
  "components/marketing-home.tsx",
  "components/site-header.tsx",
  "components/site-footer.tsx",
  "components/product-preview.tsx",
  "components/marketing-faq.tsx",
];

describe("V2 public landing copy", () => {
  it("keeps seventeen landing sections with stable ids", () => {
    assert.equal(LANDING_SECTIONS.length, 17);
    assert.deepEqual(
      LANDING_SECTIONS.map((section) => section.id),
      [
        "hero",
        "problem",
        "solution",
        "product",
        "customer-service",
        "sales-assistant",
        "lead-capture",
        "knowledge",
        "inbox",
        "handoff",
        "how-it-works",
        "widget",
        "integrations",
        "analytics",
        "pricing",
        "faq",
        "final-cta",
      ],
    );
  });

  it("uses honest CTAs that match signup and the in-page walkthrough", () => {
    assert.equal(LANDING_PRIMARY_CTA.href, "/signup");
    assert.equal(LANDING_PRIMARY_CTA.label, "Get started");
    assert.equal(LANDING_SECONDARY_CTA.href, "#how-it-works");
    assert.equal(LANDING_SECONDARY_CTA.label, "See how it works");
    assert.equal(LANDING_DEMO.href, "/demo");
    assert.deepEqual(
      LANDING_NAV.map((item) => item.href),
      ["#product", "#pricing", "#faq"],
    );
  });

  it("keeps BizPilot Pro at $29 with 500 replies and no overage", () => {
    assert.equal(BIZPILOT_PRO.amountCents, 2900);
    assert.equal(formatPlanPriceUsd(), "$29");
    assert.equal(BIZPILOT_PRO.replyLimit, 500);
    assert.equal(BIZPILOT_PRO.automaticOverageCharges, false);
    assert.match(PRICING_FEATURES.join(" "), /500 AI-generated customer replies/);
    assert.match(PRICING_FEATURES.join(" "), /Cancel anytime/);
    assert.match(PRICING_FEATURES.join(" "), /No automatic overage charges/);
  });

  it("labels the product preview as sample layout and keeps future apps disconnected", () => {
    assert.equal(PRODUCT_PREVIEW_LABEL, "Sample layout. Not live customer data.");
    const future = INTEGRATION_ITEMS.filter((item) => !item.live);
    assert.deepEqual(
      future.map((item) => item.name),
      ["Shopify", "WooCommerce", "Calendar"],
    );
    assert.ok(future.every((item) => item.status === "Not connected"));
  });

  it("does not invent a free plan or fake social proof in marketing sources", () => {
    for (const file of LANDING_FILES) {
      const source = readFileSync(file, "utf8");
      for (const phrase of FORBIDDEN) {
        assert.equal(source.includes(phrase), false, `${file} contains "${phrase}"`);
      }
      assert.doesNotMatch(source, /[★⭐]|4\.\d+\/5|as seen in|trusted by \d/i);
    }
    const home = readFileSync("components/marketing-home.tsx", "utf8");
    assert.doesNotMatch(home, /href="\/billing"/);
    assert.match(home, /id="hero"/);
    assert.match(home, /id="how-it-works"/);
    assert.match(home, /id="pricing"/);
    assert.match(home, /LANDING_PRIMARY_CTA/);
    assert.match(home, /LANDING_SECONDARY_CTA/);
    assert.match(home, /ProductPreview/);
    assert.match(home, /MarketingFaq/);
    const header = readFileSync("components/site-header.tsx", "utf8");
    assert.match(header, /LANDING_PRIMARY_CTA/);
    assert.doesNotMatch(header, />Subscribe</);
    assert.match(LANDING_HERO.demoNote, /browser-only preview/);
    assert.match(LANDING_HERO.title, /24\/7 AI Customer Service & Sales Assistant/);
    assert.match(LANDING_HERO.subtitle, /does not invent prices/);
    assert.match(FAQ_ITEMS.find((item) => item.id === "appointments")!.answer, /does not confirm a booking/);
    assert.equal(FAQ_ITEMS.length >= 6, true);
    assert.equal(
      HOME_METADATA.title,
      "Bizlyro AI — AI Business Assistant for Customer Service & Sales",
    );
    assert.match(HOME_METADATA.description, /Bizlyro AI is an AI business assistant/);
    assert.match(HOME_METADATA.description, /customer service and sales/);
    assert.match(HOME_METADATA.description, /website or store/);
    assert.match(HOME_METADATA.description, /capture leads/);
    assert.match(HOME_METADATA.description, /business knowledge/);
  });

  it("lists only public marketing URLs on the sitemap", () => {
    const urls = publicSitemapUrls().map((entry) => entry.url);
    assert.ok(urls.includes(PRODUCTION_PUBLIC_ORIGIN));
    assert.ok(urls.includes(`${PRODUCTION_PUBLIC_ORIGIN}/signup`));
    assert.ok(urls.includes(`${PRODUCTION_PUBLIC_ORIGIN}/privacy`));
    assert.equal(
      urls.some((url) => url.includes("/app") || url.includes("/api")),
      false,
    );
    const bizlyro = publicSitemapUrls(BIZLYRO_PUBLIC_ORIGIN).map((entry) => entry.url);
    assert.deepEqual(bizlyro, [
      "https://bizlyro.com",
      "https://bizlyro.com/signup",
      "https://bizlyro.com/login",
      "https://bizlyro.com/demo",
      "https://bizlyro.com/privacy",
      "https://bizlyro.com/terms",
    ]);
    assert.equal(bizlyro.some((url) => url.includes("mybizpilotai.com")), false);
    const xml = sitemapXml(BIZLYRO_PUBLIC_ORIGIN);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/);
    assert.doesNotMatch(xml, /https:\/\/www\.sitemaps\.org/);
    assert.match(xml, /<priority>1\.0<\/priority>/);
    assert.equal(xml.includes("mybizpilotai.com"), false);
    for (const url of bizlyro) assert.match(xml, new RegExp(`<loc>${url}</loc>`));
    const robots = marketingRobots(BIZLYRO_PUBLIC_ORIGIN);
    assert.equal(robots.sitemap, "https://bizlyro.com/sitemap.xml");
    assert.equal(robots.host, undefined);
    assert.deepEqual(robots.rules, {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/account", "/billing", "/embed/"],
    });
    assert.equal(homeMetadata.alternates && "canonical" in homeMetadata.alternates ? homeMetadata.alternates.canonical : "", BIZLYRO_PUBLIC_ORIGIN);
    assert.equal(homeMetadata.openGraph && "siteName" in homeMetadata.openGraph ? homeMetadata.openGraph.siteName : "", "Bizlyro AI");
    assert.equal(homeMetadata.openGraph && "url" in homeMetadata.openGraph ? homeMetadata.openGraph.url : "", BIZLYRO_PUBLIC_ORIGIN);
    assert.equal(homeMetadata.twitter && "title" in homeMetadata.twitter ? homeMetadata.twitter.title : "", HOME_METADATA.title);
    const existing = marketingRobots();
    assert.equal(existing.sitemap, `${PRODUCTION_PUBLIC_ORIGIN}/sitemap.xml`);
    assert.equal(existing.host, undefined);
    const sitemapSource = readFileSync("app/sitemap.xml/route.ts", "utf8");
    const robotsSource = readFileSync("app/robots.ts", "utf8");
    const layoutSource = readFileSync("app/layout.tsx", "utf8");
    assert.match(sitemapSource, /publicOriginForHost/);
    assert.match(sitemapSource, /application\/xml; charset=utf-8/);
    assert.match(sitemapSource, /Content-Length/);
    assert.match(robotsSource, /requestPublicOrigin/);
    assert.match(layoutSource, /requestPublicOrigin/);
    assert.doesNotMatch(sitemapSource, /mybizpilotai\.com/);
    assert.doesNotMatch(robotsSource, /mybizpilotai\.com/);
  });
});
