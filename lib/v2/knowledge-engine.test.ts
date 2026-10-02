import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BillingService } from "../billing/service";
import { MemoryBillingStore } from "../billing/memory-store";
import { applyStripeEvent } from "../billing/stripe-events";
import type { StripeLikeEvent } from "../billing/types";
import { emptyKnowledge } from "../empty-knowledge";
import { WEBSITE_NO_SOURCE_ANSWER } from "../website/answer";
import { knowledgePrompt } from "../ai/knowledge-prompt";
import { knowledgeBaseToDraftEntries } from "./knowledge-entries";
import { publishedKnowledgeBase } from "./published-knowledge";
import { syncProjectedKnowledgeEntries } from "./sync-knowledge";
import { answerLacksPublishedKnowledge } from "./unanswered";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace() {
  const store = new MemoryBillingStore();
  const user = await store.createUser({
    email: "engine@example.com",
    passwordHash: "hash",
    name: "Engine",
  });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor" });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  const checkout: StripeLikeEvent = {
    id: "evt_engine_co",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_engine",
        mode: "subscription",
        customer: "cus_engine",
        subscription: "sub_engine",
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  };
  const subscription: StripeLikeEvent = {
    id: "evt_engine_sub",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_engine",
        customer: "cus_engine",
        status: "active",
        cancel_at_period_end: false,
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
  };
  await applyStripeEvent(store, checkout);
  await applyStripeEvent(store, subscription);
  return { store, user, workspace, start };
}

describe("Knowledge Engine V2", () => {
  it("projects JSON into searchable entries without changing the JSON document", async () => {
    const { store, workspace } = await paidWorkspace();
    const knowledge = {
      ...emptyKnowledge("online_store"),
      name: "Harbor Goods",
      description: "Outdoor gear.",
      faqs: [{ id: "faq_ship", question: "Do you ship?", answer: "US only." }],
    };
    await store.saveKnowledge(workspace.id, knowledge);
    assert.equal((await store.listKnowledgeEntries(workspace.id)).length, 0);

    const entries = await syncProjectedKnowledgeEntries(store, workspace.id, knowledge);
    const loaded = await store.getWorkspace(workspace.id);
    assert.equal(loaded?.knowledge?.name, "Harbor Goods");
    assert.ok(entries.some((row) => row.kind === "faq" && row.sourceRef === "faq_ship"));
    assert.ok(entries.some((row) => row.title === "Harbor Goods" || row.content.includes("Harbor Goods")));
  });

  it("preserves disabled projected facts across re-sync and leaves extra facts alone", async () => {
    const { store, workspace } = await paidWorkspace();
    const knowledge = {
      ...emptyKnowledge("custom"),
      name: "Harbor",
      faqs: [{ id: "faq_ship", question: "Do you ship?", answer: "US only." }],
    };
    await syncProjectedKnowledgeEntries(store, workspace.id, knowledge);
    const faq = (await store.listKnowledgeEntries(workspace.id)).find((row) => row.sourceRef === "faq_ship");
    assert.ok(faq);
    await store.updateKnowledgeEntry(faq.id, workspace.id, { enabled: false });
    const extra = await store.createKnowledgeEntry(workspace.id, {
      kind: "manual",
      title: "Packaging",
      content: "Brown recycled boxes.",
      sourceType: "manual",
      sourceRef: "",
    });

    const nextKnowledge = {
      ...knowledge,
      faqs: [
        { id: "faq_ship", question: "Do you ship?", answer: "US only, two to five days." },
        { id: "faq_hours", question: "Saturday hours?", answer: "9 to 2." },
      ],
    };
    const entries = await syncProjectedKnowledgeEntries(store, workspace.id, nextKnowledge);
    const updatedFaq = entries.find((row) => row.sourceRef === "faq_ship");
    assert.equal(updatedFaq?.enabled, false);
    assert.match(updatedFaq?.content ?? "", /two to five days/);
    assert.ok(entries.some((row) => row.sourceRef === "faq_hours"));
    assert.ok(entries.some((row) => row.id === extra.id && row.content.includes("recycled boxes")));
  });

  it("hides disabled facts from the published knowledge used by chat", () => {
    const knowledge = {
      ...emptyKnowledge("custom"),
      name: "Harbor",
      faqs: [{ id: "faq_ship", question: "Do you ship?", answer: "US only." }],
    };
    const drafts = knowledgeBaseToDraftEntries(knowledge);
    const entries = drafts.map((draft, index) => ({
      id: `ent_${index}`,
      workspaceId: "ws",
      kind: draft.kind,
      title: draft.title,
      content: draft.content,
      enabled: draft.sourceRef !== "faq_ship",
      sourceType: draft.sourceType ?? "manual",
      sourceUrl: "",
      sourceLabel: draft.sourceLabel ?? "",
      sourceRef: draft.sourceRef ?? "",
      lastUpdatedAt: new Date(),
      createdAt: new Date(),
    }));
    const published = publishedKnowledgeBase(knowledge, entries);
    assert.equal(published?.faqs.some((row) => row.id === "faq_ship"), false);
    assert.match(knowledgePrompt(knowledge), /Do you ship/);
    assert.doesNotMatch(knowledgePrompt(published), /Do you ship/);
  });

  it("records an unanswered question when chat has no published source", async () => {
    const { store, workspace, start } = await paidWorkspace();
    await store.saveKnowledge(workspace.id, {
      ...emptyKnowledge("custom"),
      name: "Harbor",
    });
    const service = new BillingService(store);
    const result = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-gap",
      question: "Do you offer rush delivery to Juneau?",
      now: start,
      generate: async () => WEBSITE_NO_SOURCE_ANSWER,
    });
    assert.equal(result.waitingOnHuman, false);
    const gaps = await store.listUnansweredQuestions(workspace.id);
    assert.equal(gaps.length, 1);
    assert.equal(gaps[0]?.question, "Do you offer rush delivery to Juneau?");
    assert.equal(gaps[0]?.status, "open");

    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-gap",
      conversationId: result.conversationId,
      question: "Do you offer rush delivery to Juneau?",
      now: start,
      generate: async () => WEBSITE_NO_SOURCE_ANSWER,
    });
    assert.equal((await store.listUnansweredQuestions(workspace.id)).length, 1);
    assert.equal(answerLacksPublishedKnowledge(WEBSITE_NO_SOURCE_ANSWER), true);
    assert.equal(answerLacksPublishedKnowledge("Harbor is open Saturday."), false);
  });

  it("keeps the paid Knowledge page on the engine, editor, and website tabs", () => {
    const page = readFileSync("components/paid-knowledge.tsx", "utf8");
    const engine = readFileSync("components/knowledge-engine-panel.tsx", "utf8");
    const api = readFileSync("app/api/app/knowledge/route.ts", "utf8");
    assert.match(page, /Knowledge engine/);
    assert.match(page, /value="facts"/);
    assert.match(page, /value="edit"/);
    assert.match(page, /value="website"/);
    assert.match(engine, /Unanswered questions/);
    assert.match(engine, /Add a fact/);
    assert.match(engine, /disabled/);
    assert.match(api, /loadKnowledgeEngine/);
    assert.doesNotMatch(engine, /Start Free/);
  });
});
