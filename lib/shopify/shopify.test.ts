import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { generateCustomerReply } from "../ai/generate-customer-reply";
import { WIDGET_SYSTEM_RULES } from "../ai/knowledge-prompt";
import { MemoryBillingStore } from "../billing/memory-store";
import { BillingService } from "../billing/service";
import { applyStripeEvent } from "../billing/stripe-events";
import type { StripeLikeEvent } from "../billing/types";
import { emptyKnowledge } from "../empty-knowledge";
import { shopifyAuthorizeUrl, normalizeShopDomain, shopifyCallbackUrl, SHOPIFY_SCOPES } from "./config";
import {
  CATALOG_NO_SOURCE_ANSWER,
  groundedCatalogAnswer,
  mapShopifyAdminProduct,
  publicCatalogProducts,
  retrieveRelevantProducts,
  shopifyCatalogPrompt,
  shopifyFactsForQuery,
} from "./catalog";
import { verifyShopifyCallbackHmac } from "./hmac";
import { publicShopifyStatus, shopifyStatusLabel } from "./public";
import type { ShopifyProductRecord } from "./types";

const PRICE = "price_test_bizpilot_pro";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace(store: MemoryBillingStore, name: string) {
  const user = await store.createUser({
    email: `${name}@example.com`,
    passwordHash: "hash",
    name,
  });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name });
  await store.saveKnowledge(workspace.id, { ...emptyKnowledge("online_store"), name });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-10-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: `evt_co_${name}`,
    type: "checkout.session.completed",
    data: { object: { customer: `cus_${name}`, subscription: `sub_${name}`, metadata: { userId: user.id, workspaceId: workspace.id } } },
  } satisfies StripeLikeEvent);
  await applyStripeEvent(store, {
    id: `evt_sub_${name}`,
    type: "customer.subscription.created",
    data: {
      object: {
        id: `sub_${name}`,
        customer: `cus_${name}`,
        status: "active",
        metadata: { userId: user.id, workspaceId: workspace.id },
        items: {
          data: [{ price: { id: PRICE }, current_period_start: unix(start), current_period_end: unix(end) }],
        },
      },
    },
  } satisfies StripeLikeEvent);
  return { user, workspace, start };
}

function product(workspaceId: string, title: string, price: string, extra?: Partial<ShopifyProductRecord>): ShopifyProductRecord {
  const now = new Date("2026-10-01T00:00:00Z");
  return {
    id: `${workspaceId}-${title}`,
    workspaceId,
    shopifyProductId: title.replace(/\s+/g, "-").toLowerCase(),
    handle: title.replace(/\s+/g, "-").toLowerCase(),
    title,
    description: extra?.description ?? `${title} automatic watch`,
    status: extra?.status ?? "active",
    productType: extra?.productType ?? "Watch",
    vendor: extra?.vendor ?? "Virello",
    tags: extra?.tags ?? "automatic",
    url: extra?.url ?? `https://www.virellotimepieces.com/products/${title.replace(/\s+/g, "-").toLowerCase()}`,
    imageUrls: extra?.imageUrls ?? ["https://cdn.example/watch.jpg"],
    variants: extra?.variants ?? [
      {
        id: "1",
        title: "Default",
        sku: "SKU-1",
        price,
        compareAtPrice: null,
        available: true,
        inventoryQuantity: 4,
        inventoryTracked: true,
      },
    ],
    publishedAt: extra?.publishedAt ?? now,
    shopifyUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("Shopify OAuth helpers", () => {
  it("normalizes shop domains and builds an authorize URL without secrets", () => {
    assert.equal(normalizeShopDomain("Virello-Timepieces"), "virello-timepieces.myshopify.com");
    assert.equal(normalizeShopDomain("https://virello-timepieces.myshopify.com/admin"), "virello-timepieces.myshopify.com");
    assert.equal(normalizeShopDomain("not a shop"), null);
    const url = shopifyAuthorizeUrl({
      shop: "virello-timepieces.myshopify.com",
      apiKey: "key_public",
      redirectUri: shopifyCallbackUrl("https://www.mybizpilotai.com"),
      state: "signed-state",
    });
    const parsed = new URL(url);
    assert.equal(parsed.origin, "https://admin.shopify.com");
    assert.equal(parsed.pathname, "/store/virello-timepieces/oauth/authorize");
    assert.equal(parsed.searchParams.get("redirect_uri"), "https://www.mybizpilotai.com/api/app/shopify/callback");
    assert.equal(parsed.searchParams.get("scope"), "read_products,read_inventory");
    assert.doesNotMatch(url, /myshopify\.com\/admin\/oauth/);
    const gfd = shopifyAuthorizeUrl({
      shop: "gfd1cp-1v.myshopify.com",
      apiKey: "key_public",
      redirectUri: shopifyCallbackUrl("https://www.mybizpilotai.com"),
      state: "signed-state",
    });
    assert.equal(new URL(gfd).pathname, "/store/gfd1cp-1v/oauth/authorize");
    assert.equal(shopifyCallbackUrl("https://www.mybizpilotai.com/"), "https://www.mybizpilotai.com/api/app/shopify/callback");
    assert.match(url, /read_products/);
    assert.match(url, /read_inventory/);
    assert.doesNotMatch(url, /client_secret|SHOPIFY_API_SECRET|shpat_/);
    assert.deepEqual([...SHOPIFY_SCOPES], ["read_products", "read_inventory"]);
  });

  it("accepts a valid Shopify callback HMAC and rejects a tampered one", () => {
    const secret = "shopify-secret";
    const params = new URLSearchParams({
      code: "abc",
      shop: "virello.myshopify.com",
      state: "signed-state",
      timestamp: "1690000000",
    });
    const message = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");
    params.set("hmac", createHmac("sha256", secret).update(message).digest("hex"));
    assert.equal(verifyShopifyCallbackHmac(params, secret), true);
    params.set("shop", "evil.myshopify.com");
    assert.equal(verifyShopifyCallbackHmac(params, secret), false);
  });
});

describe("Shopify catalog mapping", () => {
  it("maps Shopify fields and does not invent inventory when Shopify omitted it", () => {
    const mapped = mapShopifyAdminProduct(
      {
        id: 11,
        title: "PD-1644",
        body_html: "<p>Automatic diver.</p>",
        handle: "pd-1644",
        status: "active",
        vendor: "Pagani Design",
        product_type: "Watch",
        tags: "automatic, diver",
        published_at: "2026-01-01T00:00:00Z",
        images: [{ src: "https://cdn.example/pd.jpg" }],
        variants: [
          {
            id: 99,
            title: "Black",
            sku: "PD1644-BLK",
            price: "189.00",
            compare_at_price: "219.00",
            inventory_management: null,
            inventory_quantity: 0,
          },
        ],
      },
      "ws-a",
      "www.virellotimepieces.com",
    );
    assert.ok(mapped);
    assert.equal(mapped?.title, "PD-1644");
    assert.equal(mapped?.description, "Automatic diver.");
    assert.equal(mapped?.url, "https://www.virellotimepieces.com/products/pd-1644");
    assert.equal(mapped?.variants[0]?.price, "189.00");
    assert.equal(mapped?.variants[0]?.compareAtPrice, "219.00");
    assert.equal(mapped?.variants[0]?.inventoryTracked, false);
    assert.equal(mapped?.variants[0]?.inventoryQuantity, null);
    assert.equal(mapped?.variants[0]?.available, null);
  });

  it("answers catalog questions from the matching workspace only and never from draft products", () => {
    const a = "ws-a";
    const b = "ws-b";
    const products = [
      product(a, "Harbor Automatic", "249.00"),
      product(a, "Draft Chronograph", "999.00", { status: "draft" }),
      product(b, "Other Store Watch", "12.00"),
    ];
    assert.equal(publicCatalogProducts(products, a).length, 1);
    const under = retrieveRelevantProducts(products, "Show me watches under $200", a);
    assert.equal(under.length, 0);
    const listed = retrieveRelevantProducts(products, "What watches do you sell?", a);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.title, "Harbor Automatic");
    assert.equal(
      retrieveRelevantProducts(products, "Harbor Automatic", b).some((row) => row.title === "Harbor Automatic"),
      false,
    );
    const grounded = groundedCatalogAnswer({
      question: "How much is the Harbor Automatic?",
      products,
      workspaceId: a,
    });
    assert.equal(grounded.usedCatalog, true);
    assert.match(grounded.answer, /249\.00/);
    assert.doesNotMatch(grounded.answer, /Other Store Watch|12\.00|999\.00/);
    const missing = groundedCatalogAnswer({ question: "Do you sell submarines?", products, workspaceId: a });
    assert.equal(missing.usedCatalog, false);
    assert.equal(missing.answer, CATALOG_NO_SOURCE_ANSWER);
    const prompt = shopifyCatalogPrompt(listed);
    assert.match(prompt, /Harbor Automatic/);
    assert.doesNotMatch(prompt, /Other Store Watch/);
    const facts = shopifyFactsForQuery(products, "automatic watch", a);
    assert.ok(facts.some((row) => row.includes("Harbor Automatic")));
    assert.ok(facts.every((row) => !row.includes("Other Store Watch")));
  });
});

describe("Shopify public status", () => {
  it("never includes token fields", () => {
    const status = publicShopifyStatus({
      id: "1",
      workspaceId: "w1",
      shopDomain: "virello.myshopify.com",
      shopName: "Virello",
      primaryDomain: "www.virellotimepieces.com",
      encryptedAccessToken: "ciphertext-shopify-token",
      scopes: "read_products",
      status: "connected",
      lastSyncedAt: new Date("2026-10-02T12:00:00Z"),
      lastSyncStatus: "success",
      lastSyncError: null,
      productCount: 3,
      connectedAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: new Date("2026-10-02T12:00:00Z"),
    });
    assert.equal(shopifyStatusLabel(status), "Connected");
    const raw = JSON.stringify(status);
    assert.doesNotMatch(raw, /ciphertext|encryptedAccessToken|shpat_/);
    assert.match(raw, /virello\.myshopify\.com/);
  });
});

describe("Shopify-powered widget answers", () => {
  it("uses catalog data without OpenAI and does not leak another workspace", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const store = new MemoryBillingStore();
      const a = await paidWorkspace(store, "Alpha");
      const b = await paidWorkspace(store, "Beta");
      await store.replaceShopifyProducts(a.workspace.id, [
        product(a.workspace.id, "Alpha Diver", "310.00", { description: "Alpha automatic diver watch" }),
      ]);
      await store.replaceShopifyProducts(b.workspace.id, [
        product(b.workspace.id, "Beta Quartz", "88.00", { description: "Beta quartz watch" }),
      ]);
      const alphaProducts = await store.listShopifyProducts(a.workspace.id);
      const mixed = [...alphaProducts, ...(await store.listShopifyProducts(b.workspace.id))];
      const answer = await generateCustomerReply(
        emptyKnowledge("online_store"),
        "How much is the Alpha Diver?",
        [],
        mixed.filter((row) => row.workspaceId === a.workspace.id),
      );
      assert.match(answer, /Alpha Diver/);
      assert.match(answer, /310\.00/);
      assert.doesNotMatch(answer, /Beta Quartz|88\.00/);
      const service = new BillingService(store);
      const counted = await service.generateCountedAiReply({
        widgetKey: a.workspace.widgetKey,
        visitorKey: "v-shopify",
        question: "What watches do you sell?",
        now: a.start,
        generate: async (knowledge, question, pages, products) => {
          assert.ok((products ?? []).every((row) => row.workspaceId === a.workspace.id));
          assert.ok(!(products ?? []).some((row) => row.title === "Beta Quartz"));
          return generateCustomerReply(knowledge, question, pages, products);
        },
      });
      assert.match(counted.answer, /Alpha Diver/);
      assert.doesNotMatch(counted.answer, /Beta Quartz/);
    } finally {
      if (previous) process.env.OPENAI_API_KEY = previous;
      else delete process.env.OPENAI_API_KEY;
    }
  });

  it("keeps Gmail private and Shopify secrets out of the public widget path", () => {
    assert.match(WIDGET_SYSTEM_RULES, /Never invent products, prices, discounts, inventory/);
    assert.match(WIDGET_SYSTEM_RULES, /Never use Gmail/);
    const widget = [
      "app/api/widget/chat/route.ts",
      "lib/ai/generate-customer-reply.ts",
      "components/widget-chat.tsx",
    ];
    for (const file of widget) {
      const source = readFileSync(file, "utf8");
      assert.doesNotMatch(source, /getGmailConnection|gmailReplyDraft|Gmail API|listGmail/);
      assert.doesNotMatch(source, /SHOPIFY_API_SECRET|encryptedAccessToken|shpat_/);
    }
    const ui = readFileSync("components/paid-integrations.tsx", "utf8");
    assert.doesNotMatch(ui, /SHOPIFY_API_SECRET|GOOGLE_CLIENT_SECRET|encryptedAccessToken/);
  });
});
