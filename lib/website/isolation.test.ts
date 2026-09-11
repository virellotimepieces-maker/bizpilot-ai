import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryBillingStore } from "../billing/memory-store";
import { BillingService } from "../billing/service";
import { applyStripeEvent } from "../billing/stripe-events";
import type { StripeLikeEvent } from "../billing/types";
import { emptyKnowledge } from "../empty-knowledge";
import { groundedWebsiteAnswer } from "./answer";
import type { WebsitePageRecord } from "./types";

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
  const workspace = await store.createWorkspace({
    ownerUserId: user.id,
    name,
  });
  await store.saveKnowledge(workspace.id, {
    ...emptyKnowledge("online_store"),
    name,
  });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-10-01T00:00:00Z");
  const checkout: StripeLikeEvent = {
    id: `evt_co_${name}`,
    type: "checkout.session.completed",
    data: {
      object: {
        customer: `cus_${name}`,
        subscription: `sub_${name}`,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  };
  const subscription: StripeLikeEvent = {
    id: `evt_sub_${name}`,
    type: "customer.subscription.created",
    data: {
      object: {
        id: `sub_${name}`,
        customer: `cus_${name}`,
        status: "active",
        metadata: { userId: user.id, workspaceId: workspace.id },
        items: {
          data: [
            {
              price: { id: PRICE },
              current_period_start: unix(start),
              current_period_end: unix(end),
            },
          ],
        },
      },
    },
  };
  await applyStripeEvent(store, checkout);
  await applyStripeEvent(store, subscription);
  return { user, workspace, start };
}

function shippingPage(
  workspaceId: string,
  widgetKey: string,
  url: string,
  content: string,
): Omit<WebsitePageRecord, "id" | "workspaceId" | "widgetKey" | "sourceId"> {
  return {
    url,
    title: "Shipping",
    kind: "shipping",
    content,
    contentHash: "h",
    lastModified: new Date("2026-09-01T00:00:00Z"),
    fetchedAt: new Date("2026-09-11T00:00:00Z"),
  };
}

describe("strict website tenant isolation", () => {
  it("one subscriber’s indexed pages never appear in another subscriber’s widget answers", async () => {
    const store = new MemoryBillingStore();
    const pine = await paidWorkspace(store, "pine");
    const rival = await paidWorkspace(store, "rival");
    const pineSource = await store.upsertWebsiteSource({
      workspaceId: pine.workspace.id,
      widgetKey: pine.workspace.widgetKey,
      domain: "pine.example",
      verifyToken: "bpv_pine",
    });
    const rivalSource = await store.upsertWebsiteSource({
      workspaceId: rival.workspace.id,
      widgetKey: rival.workspace.widgetKey,
      domain: "rival.example",
      verifyToken: "bpv_rival",
    });
    await store.replaceWebsitePages(pine.workspace.id, pine.workspace.widgetKey, pineSource.id, [
      shippingPage(
        pine.workspace.id,
        pine.workspace.widgetKey,
        "https://pine.example/policies/shipping-policy",
        "Harbor & Pine ships in 2 business days with free tracking.",
      ),
    ]);
    await store.replaceWebsitePages(rival.workspace.id, rival.workspace.widgetKey, rivalSource.id, [
      shippingPage(
        rival.workspace.id,
        rival.workspace.widgetKey,
        "https://rival.example/policies/shipping-policy",
        "Rival Co ships in 9 business days and never offers tracking.",
      ),
    ]);

    assert.equal(
      (await store.listWebsitePages(pine.workspace.id, rival.workspace.widgetKey)).length,
      0,
    );
    assert.equal(
      (await store.listWebsitePages(rival.workspace.id, pine.workspace.widgetKey)).length,
      0,
    );

    const service = new BillingService(store);
    const pineReply = await service.generateCountedAiReply({
      widgetKey: pine.workspace.widgetKey,
      visitorKey: "visitor-pine",
      question: "How fast is shipping and do you include tracking?",
      now: pine.start,
      generate: async (_knowledge, question, pages) => {
        assert.equal(pages?.every((row) => row.widgetKey === pine.workspace.widgetKey), true);
        assert.equal(pages?.every((row) => row.workspaceId === pine.workspace.id), true);
        assert.equal(pages?.some((row) => row.content.includes("9 business days")), false);
        return groundedWebsiteAnswer({
          question,
          pages: pages ?? [],
          workspaceId: pine.workspace.id,
          widgetKey: pine.workspace.widgetKey,
        }).answer;
      },
    });
    assert.match(pineReply.answer, /2 business days/);
    assert.doesNotMatch(pineReply.answer, /9 business days|Rival/);
    assert.equal(
      pineReply.sources.every((row) => row.url.startsWith("https://pine.example/")),
      true,
    );

    const stored = await store.listMessages(pineReply.conversationId, pine.workspace.id);
    const assistant = stored.find((row) => row.role === "assistant");
    assert.equal(assistant?.sources?.[0]?.url, "https://pine.example/policies/shipping-policy");
    assert.equal(
      stored.some((row) => row.content.includes("Rival") || row.content.includes("9 business")),
      false,
    );
  });
});
