import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildSocialDraftMessages } from "./ai/social-prompt";
import { composeSocialDraft, finalizeSocialDraft } from "./ai/generate-social-draft";
import { applyStripeEvent } from "./billing/stripe-events";
import { BillingService } from "./billing/service";
import { MemoryBillingStore } from "./billing/memory-store";
import { BillingError } from "./billing/types";
import { emptyKnowledge } from "./empty-knowledge";
import { draftSocialFromInbound } from "./social";
import {
  canPublishSocialDraft,
  clientMaySetSocialStatus,
  resolveSocialContentLanguage,
  socialPublishBlockedReason,
  socialWorkflowStatus,
  verifiedSocialFacts,
} from "./social-content";
import type { KnowledgeBase } from "./types";
import type { ShopifyProductRecord } from "./shopify/types";

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
  await store.saveKnowledge(workspace.id, {
    ...emptyKnowledge("custom"),
    name,
    description: `${name} publishes only the facts in its own knowledge.`,
    offerings: [
      {
        id: "class",
        kind: "service",
        name: "Evening figure class",
        summary: "Three-hour open studio.",
        price: "",
        availability: "",
        details: "",
      },
    ],
  });
  const start = new Date("2026-10-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: `co_${name}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${name}`,
        mode: "subscription",
        customer: `cus_${name}`,
        subscription: `sub_${name}`,
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  });
  await applyStripeEvent(store, {
    id: `sub_${name}`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_${name}`,
        customer: `cus_${name}`,
        status: "active",
        metadata: { userId: user.id, workspaceId: workspace.id },
        items: {
          data: [
            {
              price: { id: "price_test_bizpilot_pro" },
              current_period_start: unix(start),
              current_period_end: unix(end),
            },
          ],
        },
      },
    },
  });
  return { user, workspace, start };
}

function product(workspaceId: string, title: string, price: string): ShopifyProductRecord {
  const now = new Date("2026-10-01T00:00:00Z");
  return {
    id: `prod_${title}`,
    workspaceId,
    shopifyProductId: title,
    handle: title.toLowerCase().replace(/\s+/g, "-"),
    title,
    description: `${title} description from this workspace only.`,
    status: "active",
    productType: "",
    vendor: "",
    tags: "",
    url: "",
    imageUrls: [],
    variants: [
      {
        id: "v1",
        title: "Default",
        sku: "",
        price,
        compareAtPrice: null,
        available: null,
        inventoryQuantity: 4,
        inventoryTracked: true,
      },
    ],
    publishedAt: now,
    shopifyUpdatedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

describe("social content drafts", () => {
  it("keeps drafts inside one workspace and deletes only that workspace's row", async () => {
    const store = new MemoryBillingStore();
    const a = await paidWorkspace(store, "north");
    const b = await paidWorkspace(store, "cedar");
    const created = await store.createSocialMessage({
      workspaceId: a.workspace.id,
      widgetKey: a.workspace.widgetKey,
      platform: "linkedin",
      fromName: "New post",
      handle: "bp1.",
      body: "Announce the evening class",
      status: "draft",
      draftBody: "Evening figure class is open for enrollment.",
      intent: "unknown",
      operatorNote: "Draft only.",
      usedInternalKnowledge: false,
    });
    assert.equal((await store.listSocialMessages(b.workspace.id, b.workspace.widgetKey)).length, 0);
    assert.equal(await store.getSocialMessage(created.id, b.workspace.id, b.workspace.widgetKey), null);
    assert.equal(await store.deleteSocialMessage(created.id, b.workspace.id, b.workspace.widgetKey), false);
    assert.equal((await store.listSocialMessages(a.workspace.id, a.workspace.widgetKey)).length, 1);
    const edited = await store.updateSocialMessage(created.id, a.workspace.id, a.workspace.widgetKey, {
      draftBody: "Edited caption.",
      status: "approved",
    });
    assert.equal(edited.draftBody, "Edited caption.");
    assert.equal(edited.status, "approved");
    assert.equal(socialWorkflowStatus(edited.status), "Approved");
    assert.equal(await store.deleteSocialMessage(created.id, a.workspace.id, a.workspace.widgetKey), true);
    assert.equal((await store.listSocialMessages(a.workspace.id, a.workspace.widgetKey)).length, 0);
  });

  it("counts generation on the existing reply allowance and releases it when generation fails", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace, start } = await paidWorkspace(store, "usage");
    const service = new BillingService(store);
    const counted = await service.accountSocialGeneration(
      workspace.id,
      user.id,
      async () => "Draft caption",
      start,
    );
    assert.equal(counted.value, "Draft caption");
    assert.equal(counted.usage.used, 1);
    await assert.rejects(
      () =>
        service.accountSocialGeneration(
          workspace.id,
          user.id,
          async () => {
            throw new BillingError("model down", "invalid");
          },
          start,
        ),
      BillingError,
    );
    const usage = await service.peekUsage(workspace.id, start);
    assert.equal(usage.period.repliesUsed, 1);
    assert.equal(usage.period.repliesReserved, 0);
  });

  it("does not publish, does not accept a publish status, and does not mix another workspace's products", () => {
    const draft = draftSocialFromInbound({
      kb: { ...emptyKnowledge("custom"), name: "North Studio" },
      platform: "instagram",
      mode: "post",
      goal: "announcement",
      body: "Studio hours this week",
    });
    assert.equal(draft.status, "draft_ready");
    assert.notEqual(draft.status, "published");
    assert.equal(canPublishSocialDraft("draft"), false);
    assert.equal(clientMaySetSocialStatus("published"), false);
    assert.equal(clientMaySetSocialStatus("posted"), false);
    assert.equal(clientMaySetSocialStatus("approved"), true);
    assert.match(socialPublishBlockedReason(), /Connect the social account/);
    const route = readFileSync("app/api/app/social/route.ts", "utf8");
    assert.match(route, /selectOperatingWorkspace/);
    assert.doesNotMatch(route, /status:\s*"published"/);
    assert.match(route, /socialPublishBlockedReason/);
    const facts = verifiedSocialFacts({
      knowledge: { ...emptyKnowledge("custom"), name: "North Studio" } as KnowledgeBase,
      instruction: "Spotlight the public class",
      goal: "product_spotlight",
      workspaceId: "workspace-a",
      products: [product("workspace-b", "Secret Cedar Watch", "88.00")],
    });
    assert.doesNotMatch(facts.join("\n"), /Secret Cedar Watch/);
    assert.doesNotMatch(facts.join("\n"), /88\.00/);
  });

  it("writes in the requested language and drops prices, discounts, stock, testimonials, and URLs that are not verified", () => {
    assert.equal(resolveSocialContentLanguage({ choice: "auto", instruction: "明日のクラスを紹介してください" }), "ja");
    assert.equal(resolveSocialContentLanguage({ choice: "fr", instruction: "hello" }), "fr");
    assert.equal(resolveSocialContentLanguage({ choice: "other", instruction: "", other: "Swedish" }), "Swedish");
    const messages = buildSocialDraftMessages({
      knowledge: { ...emptyKnowledge("custom"), name: "North Studio" },
      platform: "linkedin",
      mode: "post",
      body: "Présentez le cours du soir",
      tone: "professional",
      goal: "educational",
      hashtags: "suggested",
      language: "French",
    });
    assert.match(messages[1].content, /French/);
    assert.match(messages[1].content, /LinkedIn/);
    const french = finalizeSocialDraft("Le cours du soir est ouvert.", {
      knowledge: { ...emptyKnowledge("custom"), name: "North Studio" },
      platform: "linkedin",
      mode: "post",
      body: "Présentez le cours du soir",
      goal: "educational",
      language: "French",
    });
    assert.match(french, /cours du soir/);
    const stripped = composeSocialDraft({
      knowledge: { ...emptyKnowledge("custom"), name: "North Studio" },
      platform: "facebook",
      mode: "post",
      goal: "product_spotlight",
      body: "Spotlight the evening class",
      extraFacts: ["Evening figure class. Three-hour open studio."],
    });
    const invented = finalizeSocialDraft(
      `${stripped}\n\nOnly $99 today, 50% off. Customers say it is five-star. In stock. https://invented.example/deal`,
      {
        knowledge: { ...emptyKnowledge("custom"), name: "North Studio" },
        platform: "facebook",
        mode: "post",
        goal: "product_spotlight",
        body: "Spotlight the evening class",
        extraFacts: ["Evening figure class. Three-hour open studio."],
      },
    );
    assert.doesNotMatch(invented, /\$99/);
    assert.doesNotMatch(invented, /50%/);
    assert.doesNotMatch(invented, /Customers say|five-star|In stock/i);
    assert.doesNotMatch(invented, /invented\.example/);
    assert.match(invented, /evening class/i);
  });
});
