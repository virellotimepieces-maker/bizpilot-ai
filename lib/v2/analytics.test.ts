import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { type StripeLikeEvent } from "../billing/types";
import { BillingService } from "../billing/service";
import { MemoryBillingStore } from "../billing/memory-store";
import { applyStripeEvent } from "../billing/stripe-events";
import { ANALYTICS_HINT, buildWorkspaceAnalytics, serializeAnalytics } from "./analytics";
import { BIZPILOT_PRO } from "../plan";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace(email = "analytics@example.com") {
  const store = new MemoryBillingStore();
  const user = await store.createUser({
    email,
    passwordHash: "hash",
    name: "Analytics",
  });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor" });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: `evt_an_${email}_co`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_an_${email}`,
        mode: "subscription",
        customer: `cus_an_${email}`,
        subscription: `sub_an_${email}`,
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  } satisfies StripeLikeEvent);
  await applyStripeEvent(store, {
    id: `evt_an_${email}_sub`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_an_${email}`,
        customer: `cus_an_${email}`,
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
  } satisfies StripeLikeEvent);
  return { store, user, workspace, start, service: new BillingService(store) };
}

describe("Analytics helpers", () => {
  it("counts stored rows and does not invent a conversion rate", () => {
    const snapshot = buildWorkspaceAnalytics({
      conversations: [],
      leads: [],
      quotes: [],
      appointments: [],
      unanswered: [],
      knowledgeEntries: [],
      websitePages: 0,
      usage: {
        used: 0,
        reserved: 0,
        limit: BIZPILOT_PRO.replyLimit,
        remaining: BIZPILOT_PRO.replyLimit,
        periodStart: new Date("2026-09-01T00:00:00Z"),
        periodEnd: new Date("2026-11-01T00:00:00Z"),
      },
    });
    assert.equal(snapshot.hasVisitorActivity, false);
    assert.equal(snapshot.usage.used, 0);
    assert.equal(snapshot.conversations.total, 0);
    const serialized = serializeAnalytics(snapshot);
    assert.equal("conversionRate" in serialized, false);
    assert.equal("revenue" in serialized, false);
    assert.match(serialized.usage.periodStart, /T/);
  });
});

describe("Workspace analytics", () => {
  it("stays empty until visitor records exist", async () => {
    const { workspace, service, start } = await paidWorkspace();
    const snapshot = await service.loadWorkspaceAnalytics(workspace.id, start);
    assert.equal(snapshot.hasVisitorActivity, false);
    assert.equal(snapshot.usage.used, 0);
    assert.equal(snapshot.usage.limit, BIZPILOT_PRO.replyLimit);
    assert.equal(snapshot.leads.total, 0);
    assert.equal(snapshot.quotes.total, 0);
    assert.equal(snapshot.appointments.total, 0);
  });

  it("counts stored conversations, leads, and requests without mixing workspaces", async () => {
    const { store, workspace, user, service, start } = await paidWorkspace("analytics-a@example.com");
    const other = await store.createWorkspace({ ownerUserId: user.id, name: "Inland" });
    const conversation = await store.createConversation({
      workspaceId: workspace.id,
      visitorKey: "v-an",
    });
    await store.setConversationWaiting(conversation.id, workspace.id, true);
    await store.updateConversation(conversation.id, workspace.id, { customerIntent: "quote_request" });
    await store.createLead(workspace.id, { status: "new", name: "Pat" });
    await store.createLead(workspace.id, { status: "qualified", name: "Kim" });
    await store.createQuoteRequest(workspace.id, { productService: "Tent" });
    await store.createAppointmentRequest(workspace.id, { requestedService: "Consult" });
    await store.createUnansweredQuestion({ workspaceId: workspace.id, question: "Rush to Juneau?" });
    await store.createLead(other.id, { status: "new", name: "Other" });
    await store.createQuoteRequest(other.id, { productService: "Other" });

    const snapshot = await service.loadWorkspaceAnalytics(workspace.id, start);
    assert.equal(snapshot.hasVisitorActivity, true);
    assert.equal(snapshot.conversations.total, 1);
    assert.equal(snapshot.conversations.waitingOnHuman, 1);
    assert.equal(snapshot.leads.total, 2);
    assert.equal(snapshot.leads.new, 1);
    assert.equal(snapshot.leads.qualified, 1);
    assert.equal(snapshot.quotes.total, 1);
    assert.equal(snapshot.quotes.open, 1);
    assert.equal(snapshot.appointments.total, 1);
    assert.equal(snapshot.unanswered.open, 1);
    assert.equal(snapshot.intents.find((row) => row.id === "quote_request")?.count, 1);
    assert.equal((await store.listLeads(other.id)).length, 1);
    assert.equal((await store.listQuoteRequests(other.id)).length, 1);
  });

  it("counts a billed AI reply in usage and keeps copy honest", async () => {
    const { workspace, service, start } = await paidWorkspace("analytics-ai@example.com");
    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-ai",
      question: "What are your hours?",
      now: start,
      generate: async () => "Saturday 10–4.",
    });
    const snapshot = await service.loadWorkspaceAnalytics(workspace.id, start);
    assert.equal(snapshot.usage.used, 1);
    assert.equal(snapshot.hasVisitorActivity, true);
    assert.equal(snapshot.conversations.total, 1);
    assert.equal("conversionRate" in snapshot, false);

    const ui = readFileSync("components/paid-analytics.tsx", "utf8");
    const page = readFileSync("app/app/analytics/page.tsx", "utf8");
    assert.match(page, /PaidAnalytics/);
    assert.doesNotMatch(page, /DeskPlaceholderPage/);
    assert.match(ui, /ANALYTICS_HINT/);
    assert.match(ui, /No visitor activity stored yet/);
    assert.doesNotMatch(ui, /conversion rate|customers served|Start Free|sample traffic/i);
    assert.match(ANALYTICS_HINT, /stored workspace records/);
  });
});
