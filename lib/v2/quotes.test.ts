import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BillingError, type StripeLikeEvent } from "../billing/types";
import { BillingService } from "../billing/service";
import { MemoryBillingStore } from "../billing/memory-store";
import { applyStripeEvent } from "../billing/stripe-events";
import {
  extractQuotedProductService,
  filterQuoteRequests,
  isQuoteRequestQuestion,
  parseQuotePatch,
  QUOTE_REQUEST_HINT,
  QUOTE_SENT_HINT,
  quoteCounts,
  quoteDisplayName,
  serializeQuoteRequest,
} from "./quotes";
import { newQuoteRequest } from "./records";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace() {
  const store = new MemoryBillingStore();
  const user = await store.createUser({
    email: "quotes@example.com",
    passwordHash: "hash",
    name: "Quotes",
  });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor" });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: "evt_quotes_co",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_quotes",
        mode: "subscription",
        customer: "cus_quotes",
        subscription: "sub_quotes",
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  } satisfies StripeLikeEvent);
  await applyStripeEvent(store, {
    id: "evt_quotes_sub",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_quotes",
        customer: "cus_quotes",
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

describe("Quote request helpers", () => {
  it("detects quote and estimate language without treating every price question as a request", () => {
    assert.equal(isQuoteRequestQuestion("How do I get a quote?"), true);
    assert.equal(isQuoteRequestQuestion("Can I get a quote for a kitchen install?"), true);
    assert.equal(isQuoteRequestQuestion("Please send an estimate for two-person tents."), true);
    assert.equal(isQuoteRequestQuestion("What are your hours?"), false);
    assert.equal(isQuoteRequestQuestion("How much does shipping cost?"), false);
    assert.equal(isQuoteRequestQuestion("I'd like to book an appointment"), false);
    assert.equal(extractQuotedProductService("Can I get a quote for a kitchen install?"), "a kitchen install");
    assert.equal(extractQuotedProductService("How do I get a quote?"), "");
    assert.equal(extractQuotedProductService("Quote for tents at $49"), "");
  });

  it("filters stored rows without inventing prices", () => {
    const rows = [
      newQuoteRequest("ws", { customerName: "Pat", email: "pat@example.com", status: "requested" }),
      newQuoteRequest("ws", { customerName: "Kim", email: "kim@example.com", status: "sent" }),
    ];
    assert.equal(filterQuoteRequests(rows, { status: "requested" }).length, 1);
    assert.equal(filterQuoteRequests(rows, { query: "kim@" }).length, 1);
    assert.deepEqual(quoteCounts(rows), {
      total: 2,
      requested: 1,
      in_review: 0,
      sent: 1,
      closed: 0,
      open: 1,
    });
    assert.equal(quoteDisplayName({ customerName: "", email: "pat@example.com" }), "pat@example.com");
    assert.equal(serializeQuoteRequest(rows[0]).status, "requested");
    assert.equal(parseQuotePatch({ status: "in_review" }).status, "in_review");
    assert.throws(
      () => parseQuotePatch({ status: "issued" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
    assert.throws(
      () => parseQuotePatch({ productService: "Secret tent", price: "$49" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
  });
});

describe("Widget questions create quote requests", () => {
  it("stores one open request per conversation and notifies the owner", async () => {
    const { store, workspace, user, service, start } = await paidWorkspace();
    const first = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-quote",
      question: "How do I get a quote?",
      now: start,
      generate: async () => "I can pass a quote request to the team. I do not issue prices here.",
    });
    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-quote",
      conversationId: first.conversationId,
      question: "Can I get a quote for a kitchen install?",
      now: start,
      generate: async () => "The team will review that request.",
    });
    const quotes = await service.listWorkspaceQuoteRequests(workspace.id);
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].status, "requested");
    assert.equal(quotes[0].conversationId, first.conversationId);
    assert.match(quotes[0].requirements, /kitchen install/i);
    assert.equal(quotes[0].productService, "a kitchen install");
    const conversation = await store.getConversation(first.conversationId, workspace.id);
    assert.equal(conversation?.customerIntent, "quote_request");
    const notices = await store.listNotifications(user.id, workspace.id);
    assert.equal(notices.filter((row) => row.type === "quote_request").length, 1);
    assert.equal((await store.listAppointmentRequests(workspace.id)).length, 0);
    assert.equal((await store.listLeads(workspace.id)).length, 0);
  });

  it("does not capture hours or generic pricing questions", async () => {
    const { store, workspace, service, start } = await paidWorkspace();
    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-hours",
      question: "What are your hours?",
      now: start,
      generate: async () => "Saturday 10–4.",
    });
    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-price",
      question: "How much does shipping cost?",
      now: start,
      generate: async () => "Published shipping notes are in Knowledge when they exist.",
    });
    assert.equal((await store.listQuoteRequests(workspace.id)).length, 0);
    assert.equal((await store.listAppointmentRequests(workspace.id)).length, 0);
  });

  it("fills contact on an existing request and keeps marked sent as owner-only", async () => {
    const { store, workspace, service, start } = await paidWorkspace();
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: true });
    const chat = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-contact",
      question: "Need a quote for trail tents",
      now: start,
      generate: async () => "I will pass that request to the team.",
    });
    await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-contact",
      conversationId: chat.conversationId,
      name: "Pat Rivera",
      email: "pat@example.com",
    });
    const quotes = await store.listQuoteRequests(workspace.id);
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].customerName, "Pat Rivera");
    assert.equal(quotes[0].email, "pat@example.com");
    const lead = (await store.listLeads(workspace.id))[0];
    assert.equal(quotes[0].leadId, lead.id);
    assert.equal(lead.intent, "quote_request");
    const marked = await service.updateWorkspaceQuoteRequest(workspace.id, quotes[0].id, {
      status: "sent",
      notes: "Emailed from the shop account.",
    });
    assert.equal(marked.status, "sent");
    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-contact",
      conversationId: chat.conversationId,
      question: "Can I also get a quote for poles?",
      now: start,
      generate: async () => "Another request is in for the team.",
    });
    assert.equal((await store.listQuoteRequests(workspace.id)).length, 2);
    await assert.rejects(
      () => service.updateWorkspaceQuoteRequest(workspace.id, "missing", { status: "closed" }),
      (error: unknown) => error instanceof BillingError && error.code === "not_found",
    );
  });

  it("keeps workspaces isolated and copy honest", async () => {
    const { store, workspace, service, start } = await paidWorkspace();
    const other = await store.createWorkspace({
      ownerUserId: (
        await store.createUser({
          email: "other-quotes@example.com",
          passwordHash: "hash",
          name: "Other",
        })
      ).id,
      name: "Inland",
    });
    const result = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-iso",
      question: "How do I get a quote?",
      now: start,
      generate: async () => "The team reviews quote requests.",
    });
    const quote = (await store.listQuoteRequests(workspace.id))[0];
    assert.equal((await store.listQuoteRequests(other.id)).length, 0);
    await assert.rejects(
      () => service.updateWorkspaceQuoteRequest(other.id, quote.id, { status: "closed" }),
      (error: unknown) => error instanceof BillingError && error.code === "not_found",
    );
    assert.ok(result.conversationId);
    const ui = readFileSync("components/paid-quotes.tsx", "utf8");
    const sales = readFileSync("components/paid-sales.tsx", "utf8");
    const page = readFileSync("app/app/quotes/page.tsx", "utf8");
    assert.match(ui, /No quote requests stored yet/);
    assert.match(ui, /QUOTE_SENT_HINT/);
    assert.match(ui, /QUOTE_REQUEST_HINT/);
    assert.doesNotMatch(ui, /issued quote|confirmed quote|Start Free/i);
    assert.doesNotMatch(ui, /\$\d/);
    assert.match(sales, /\/app\/quotes/);
    assert.match(page, /PaidSales/);
    assert.doesNotMatch(page, /DeskPlaceholderPage/);
    assert.match(QUOTE_SENT_HINT, /did not issue/);
    assert.match(QUOTE_REQUEST_HINT, /never issues a price/);
  });
});
