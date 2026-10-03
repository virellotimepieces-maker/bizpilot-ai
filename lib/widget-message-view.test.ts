import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { catalogProductSources } from "./shopify/catalog";
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

  it("shows at most four products until the visitor asks for the rest", () => {
    const products = ["One", "Two", "Three", "Four", "Five"].map((name) => ({
      name,
      price: "$10.00" as string | null,
      description: null,
      href: `https://virellotimepieces.com/products/${name.toLowerCase()}`,
    }));
    assert.equal(WIDGET_PRODUCT_PREVIEW_LIMIT, 4);
    assert.equal(visibleProductCards(products, false).length, 4);
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
});
