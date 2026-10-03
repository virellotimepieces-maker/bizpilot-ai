import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogProductSources, decorateProductSources, linkCatalogProductCards } from "./shopify/catalog";
import type { ShopifyProductRecord } from "./shopify/types";
import {
  presentAssistantMessage,
  productCardsFromSources,
  safeProductHref,
  stripMarkdownMarkers,
  visibleProductCards,
  WIDGET_PRODUCT_PREVIEW_LIMIT,
} from "./widget-message-view";

function product(title: string, price: string, description: string): ShopifyProductRecord {
  const now = new Date("2026-10-01T00:00:00Z");
  return {
    id: title,
    workspaceId: "ws",
    shopifyProductId: title,
    handle: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    description,
    status: "active",
    productType: "Watch",
    vendor: "Virello",
    tags: "",
    url: `https://virellotimepieces.com/products/${title.toLowerCase().replace(/\s+/g, "-")}`,
    imageUrls: [],
    variants: [
      {
        id: "1",
        title: "Default",
        sku: "",
        price,
        compareAtPrice: "9999.00",
        available: true,
        inventoryQuantity: 2,
        inventoryTracked: true,
      },
    ],
    publishedAt: now,
    shopifyUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("widget product answer presentation", () => {
  it("builds cards from stored Shopify sources and hides raw urls and markdown", () => {
    const sources = catalogProductSources([
      product("Harbor Automatic", "249.00", "A steel automatic watch. The dial is blue."),
      product("Field GMT", "310.50", "A travel GMT with a leather strap."),
    ]);
    const view = presentAssistantMessage(
      "**Harbor Automatic** — $249.00 — https://virellotimepieces.com/products/harbor-automatic\n\nWe can help with shipping questions.",
      sources,
    );
    assert.equal(view.products.length, 1);
    assert.equal(view.products[0]?.name, "Harbor Automatic");
    assert.equal(
      view.products.some((card) => card.name === "Field GMT"),
      false,
    );
    assert.equal(view.products[0]?.price, "$249.00");
    assert.equal(view.products[0]?.description, "A steel automatic watch. The dial is blue.");
    assert.equal(view.products[0]?.href, "https://virellotimepieces.com/products/harbor-automatic");
    assert.doesNotMatch(view.prose, /\*\*|https?:\/\//);
    assert.match(view.prose, /shipping questions/);
    assert.doesNotMatch(view.prose, /Harbor Automatic/);
  });

  it("does not invent a price, description, or link that the source does not provide", () => {
    const cards = productCardsFromSources([
      { title: "Plain Dial", url: "javascript:alert(1)", kind: "product" },
      { title: "Other page", url: "https://virellotimepieces.com/pages/shipping", kind: "shipping" },
      { title: "<b>Script</b>", url: "http://evil.example/products/x", kind: "product", price: "free", description: "<script>alert(1)</script>Steel case." },
    ]);
    assert.equal(cards.length, 2);
    assert.equal(cards[0]?.price, null);
    assert.equal(cards[0]?.description, null);
    assert.equal(cards[0]?.href, null);
    assert.equal(cards[1]?.name, "Script");
    assert.equal(cards[1]?.href, null);
    assert.equal(cards[1]?.price, null);
    assert.equal(cards[1]?.description, "Steel case.");
    assert.equal(safeProductHref("https://user:pass@virellotimepieces.com/products/a"), null);
  });

  it("shows the matching product first and keeps the rest behind show more", () => {
    const products = ["One", "Two", "Three", "Four", "Five"].map((name) => ({
      name,
      price: "$10.00" as string | null,
      description: null,
      href: `https://virellotimepieces.com/products/${name.toLowerCase()}`,
      imageUrl: null,
    }));
    assert.equal(WIDGET_PRODUCT_PREVIEW_LIMIT, 1);
    assert.equal(visibleProductCards(products, false).length, 1);
    assert.equal(visibleProductCards(products, false)[0]?.name, "One");
    assert.equal(visibleProductCards(products, true).length, 5);
  });

  it("strips emphasis markers without treating the text as HTML", () => {
    assert.equal(stripMarkdownMarkers("See **Field GMT** today"), "See Field GMT today");
    assert.match(stripMarkdownMarkers("<b>Field GMT</b>"), /<b>Field GMT<\/b>/);
  });

  it("uses only the product's own Shopify price and ignores compare-at price", () => {
    const [card] = catalogProductSources([
      {
        ...product("Range Watch", "100.00", "First sentence. Second sentence. Third sentence should stay out."),
        variants: [
          {
            id: "1",
            title: "Steel",
            sku: "",
            price: "100.00",
            compareAtPrice: "400.00",
            available: null,
            inventoryQuantity: null,
            inventoryTracked: false,
          },
          {
            id: "2",
            title: "Gold",
            sku: "",
            price: "180.00",
            compareAtPrice: null,
            available: null,
            inventoryQuantity: null,
            inventoryTracked: false,
          },
        ],
      },
    ]);
    assert.equal(card?.price, "$100.00 – $180.00");
    assert.equal(card?.description, "First sentence. Second sentence.");
    assert.doesNotMatch(card?.description ?? "", /Third sentence/);
    assert.doesNotMatch(JSON.stringify(card), /400\.00/);
  });

  it("renders the live AD2030 markdown recommendation as one product card", () => {
    const href =
      "https://virellotimepieces.com/products/addiesdive-mens-quartz-wristwatch-bubble-mirror-glass-100m-waterproof-316l-stainless-steel-luxury-business-style-watches-ad2030";
    const imageUrl =
      "https://cdn.shopify.com/s/files/1/0996/7704/5043/files/S042d4c3b8e984e6fb1015f88a43ff368M.webp?v=1787021130";
    const content = [
      "For everyday wear, I recommend the ADDIESDIVE AD2030: Compact 36mm Quartz Watch.",
      "It is water resistant to 100m and made from 316L stainless steel.",
      `You can explore more about it [here](${href}).`,
    ].join(" ");
    const view = presentAssistantMessage(content, [
      {
        title: "ADDIESDIVE AD2030: Compact 36mm Quartz Watch",
        url: href,
        kind: "product",
        price: "$200.99 – $202.99",
        imageUrl,
      },
    ]);
    assert.equal(view.products.length, 1);
    assert.equal(view.products[0]?.name, "ADDIESDIVE AD2030: Compact 36mm Quartz Watch");
    assert.equal(view.products[0]?.href, href);
    assert.equal(view.products[0]?.price, "$200.99 – $202.99");
    assert.equal(view.products[0]?.imageUrl, imageUrl);
    assert.match(view.prose, /For everyday wear/);
    assert.doesNotMatch(view.prose, /water resistant|stainless|\[here\]|https?:\/\/|\bhere\b/i);
  });

  it("keeps an everyday-wear recommendation to a few sentences and leaves specs on the card", () => {
    const href =
      "https://virellotimepieces.com/products/addiesdive-mens-quartz-wristwatch-bubble-mirror-glass-100m-waterproof-316l-stainless-steel-luxury-business-style-watches-ad2030";
    const content = [
      "For everyday wear, I recommend the ADDIESDIVE AD2030: Compact 36mm Quartz Watch.",
      "It features a polished stainless steel exterior, a clear Arabic numeral dial, and dependable Japanese quartz movement.",
      "With 100m water resistance, it is a versatile choice for daily use.",
      "The price is $200.99.",
      "Best regards,",
      "Virello Timepieces Support",
      "virellotimepieces@gmail.com",
    ].join("\n\n");
    const view = presentAssistantMessage(content, [
      {
        title: "Pagani Design Panda Chronograph Watch",
        url: "https://virellotimepieces.com/products/pagani-panda",
        kind: "product",
        price: "$211.99",
        description: "A panda dial chronograph.",
      },
      {
        title: "ADDIESDIVE AD2030: Compact 36mm Quartz Watch",
        url: href,
        kind: "product",
        price: "$200.99 – $202.99",
        description:
          "The ADDIESDIVE AD2030 combines a polished stainless steel exterior, a clear Arabic numeral dial, and Japanese quartz movement. It has 100m water resistance for daily use.",
      },
    ]);
    assert.equal(view.products[0]?.name, "ADDIESDIVE AD2030: Compact 36mm Quartz Watch");
    assert.equal(view.products[0]?.href, href);
    assert.match(view.prose, /For everyday wear, I recommend the ADDIESDIVE AD2030\./);
    assert.doesNotMatch(view.prose, /Compact 36mm|water resistance|\$200\.99|Best regards|@/);
    assert.ok(view.prose.split(/(?<=[.!?])\s+/).filter(Boolean).length <= 2);
  });

  it("keeps at most two recommendation sentences and still returns the product image", () => {
    const imageUrl = "https://cdn.shopify.com/s/files/1/0996/7704/5043/files/watch.webp";
    const view = presentAssistantMessage(
      "For everyday wear, the ADDIESDIVE AD2030: Compact 36mm Quartz Watch is a comfortable choice. It is easy to dress up or down. A third sentence should stay out of the message.",
      [
        {
          title: "ADDIESDIVE AD2030: Compact 36mm Quartz Watch",
          url: "https://virellotimepieces.com/products/addiesdive-ad2030",
          kind: "product",
          price: "$200.99",
          imageUrl,
        },
      ],
    );
    const sentences = view.prose.split(/(?<=[.!?])\s+/).filter(Boolean);
    assert.equal(sentences.length, 2);
    assert.match(view.prose, /comfortable choice/);
    assert.match(view.prose, /dress up or down/);
    assert.doesNotMatch(view.prose, /third sentence/);
    assert.equal(view.products[0]?.imageUrl, imageUrl);
  });

  it("renders the product card and image when the reply names the product and has no url", () => {
    const href =
      "https://virellotimepieces.com/products/addiesdive-mens-quartz-wristwatch-bubble-mirror-glass-100m-waterproof-316l-stainless-steel-luxury-business-style-watches-ad2030";
    const imageUrl =
      "https://cdn.shopify.com/s/files/1/0996/7704/5043/files/S042d4c3b8e984e6fb1015f88a43ff368M.webp?v=1787021130";
    const content = [
      "I recommend the ADDIESDIVE AD2030, a compact 36mm quartz watch that combines style and functionality, making it perfect for everyday wear.",
      "Its durable stainless steel construction and 100m water resistance ensure reliability for daily activities.",
    ].join(" ");
    const watched = {
      ...product("ADDIESDIVE AD2030: Compact 36mm Quartz Watch", "200.99", "A compact quartz watch for daily wear."),
      url: href,
      imageUrls: [imageUrl],
    };
    const other = product("Pagani Design GMT Automatic Watch with Sapphire Crystal", "246.99", "A GMT watch.");
    const linked = linkCatalogProductCards<
      { title: string; url: string; kind: "product"; price?: string; imageUrl?: string; description?: string }
    >([], [other, watched], content);
    assert.equal(linked.length, 1);
    assert.equal(linked[0]?.title, watched.title);
    assert.equal(linked[0]?.imageUrl, imageUrl);
    assert.equal(linked[0]?.url, href);
    const view = presentAssistantMessage(content, [
      { title: other.title, url: other.url, kind: "product", price: "$246.99", imageUrl: "https://cdn.shopify.com/s/files/1/0996/7704/5043/files/other.webp" },
      { title: watched.title, url: href, kind: "product", price: "$200.99", description: watched.description, imageUrl },
    ]);
    assert.equal(view.products.length, 1);
    assert.equal(view.products[0]?.name, watched.title);
    assert.equal(view.products[0]?.imageUrl, imageUrl);
    assert.equal(view.products[0]?.href, href);
    assert.equal(view.products[0]?.price, "$200.99");
    assert.equal(view.products[0]?.description, "A compact quartz watch for daily wear.");
    assert.match(view.prose, /ADDIESDIVE AD2030/);
    assert.doesNotMatch(view.prose, /https?:\/\/|\$200\.99|stainless|water resistance/);
    assert.equal(view.prose.split(/(?<=[.!?])\s+/).filter(Boolean).length, 1);
  });

  it("keeps an ordinary site link as text and ignores unsafe image urls", () => {
    const view = presentAssistantMessage(
      "Visit [Virello Timepieces](https://virellotimepieces.com) for store details.",
      [],
    );
    assert.equal(view.products.length, 0);
    assert.match(view.prose, /Virello Timepieces/);
    assert.doesNotMatch(view.prose, /\[Virello Timepieces\]/);
    const cards = productCardsFromSources(
      [
        {
          title: "Plain Dial",
          url: "https://virellotimepieces.com/products/plain-dial",
          kind: "product",
          imageUrl: "javascript:alert(1)",
        },
      ],
      "The Plain Dial is available.",
    );
    assert.equal(cards[0]?.imageUrl, null);
    assert.equal(cards[0]?.href, "https://virellotimepieces.com/products/plain-dial");
  });

  it("fills image and price from the synced Shopify product for a stored url-only source", () => {
    const href =
      "https://virellotimepieces.com/products/addiesdive-mens-quartz-wristwatch-bubble-mirror-glass-100m-waterproof-316l-stainless-steel-luxury-business-style-watches-ad2030";
    const imageUrl =
      "https://cdn.shopify.com/s/files/1/0996/7704/5043/files/S042d4c3b8e984e6fb1015f88a43ff368M.webp?v=1787021130";
    const watched = {
      ...product("ADDIESDIVE AD2030: Compact 36mm Quartz Watch", "200.99", "A compact quartz watch. The case is steel."),
      url: href,
      imageUrls: [imageUrl, "javascript:alert(1)"],
      variants: [
        {
          id: "1",
          title: "Black",
          sku: "",
          price: "200.99",
          compareAtPrice: "400.00",
          available: true,
          inventoryQuantity: 1,
          inventoryTracked: true,
        },
        {
          id: "2",
          title: "Blue",
          sku: "",
          price: "202.99",
          compareAtPrice: null,
          available: true,
          inventoryQuantity: 1,
          inventoryTracked: true,
        },
      ],
    };
    const other = product("Other Watch", "10.00", "Different product.");
    const content = `You can explore more about it [here](${href}).`;
    const decorated = decorateProductSources<
      { title: string; url: string; kind: "product"; price?: string; imageUrl?: string; description?: string }
    >([{ title: watched.title, url: href, kind: "product" }], [watched, other]);
    assert.equal(decorated?.[0]?.price, "$200.99 – $202.99");
    assert.equal(decorated?.[0]?.imageUrl, imageUrl);
    assert.equal(decorated?.[0]?.title, watched.title);
    assert.notEqual(decorated?.[0]?.url, other.url);
    const linked = linkCatalogProductCards<
      { title: string; url: string; kind: "product"; price?: string; imageUrl?: string; description?: string }
    >([], [watched, other], content);
    assert.equal(linked.length, 1);
    assert.equal(linked[0]?.url, href);
    assert.equal(linked[0]?.imageUrl, imageUrl);
    const view = presentAssistantMessage(content, decorated);
    assert.equal(view.products[0]?.name, watched.title);
    assert.equal(view.products[0]?.href, href);
    assert.doesNotMatch(view.prose, /\[here\]|https?:\/\//);
  });
});
