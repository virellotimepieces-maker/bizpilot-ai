import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryBillingStore } from "../billing/memory-store";
import { BillingError } from "../billing/types";
import { emptyKnowledge } from "../empty-knowledge";
import { customerIntentFromReplyIntent, isHighIntent } from "./intents";
import { knowledgeBaseToDraftEntries } from "./knowledge-entries";
import { conversationIsUnread, deskOverviewCounts } from "./metrics";
import { DEFAULT_AI_IDENTIFICATION, DEFAULT_WIDGET_WELCOME } from "./widget-settings";

async function twoWorkspaces() {
  const store = new MemoryBillingStore();
  const ownerA = await store.createUser({
    email: "a@example.com",
    passwordHash: "hash",
    name: "A",
  });
  const ownerB = await store.createUser({
    email: "b@example.com",
    passwordHash: "hash",
    name: "B",
  });
  const workspaceA = await store.createWorkspace({ ownerUserId: ownerA.id, name: "Harbor" });
  const workspaceB = await store.createWorkspace({ ownerUserId: ownerB.id, name: "Inland" });
  return { store, ownerA, ownerB, workspaceA, workspaceB };
}

describe("V2 knowledge projection", () => {
  it("does not invent entries from blank knowledge templates", () => {
    const drafts = knowledgeBaseToDraftEntries(emptyKnowledge("online_store"));
    assert.equal(
      drafts.some((row) => row.kind === "product" || row.kind === "faq"),
      false,
    );
  });

  it("projects approved business facts with source tracking", () => {
    const drafts = knowledgeBaseToDraftEntries({
      ...emptyKnowledge("online_store"),
      name: "Harbor Goods",
      tagline: "Outdoor gear",
      description: "We sell tents.",
      offerings: [
        {
          id: "off_1",
          kind: "product",
          name: "Trail tent",
          summary: "Two-person tent",
          price: "$180",
          availability: "In stock",
          details: "3-season",
        },
      ],
      faqs: [{ id: "faq_1", question: "Do you ship?", answer: "Yes, US only." }],
      policies: [{ id: "pol_1", title: "Returns", summary: "30 days unused." }],
      documents: [{ id: "doc_1", title: "Catalog notes", body: "Future PDF placeholder body.", visibility: "public" }],
    });
    assert.ok(drafts.some((row) => row.kind === "business" && row.content.includes("Harbor Goods")));
    assert.ok(drafts.some((row) => row.kind === "product" && row.sourceRef === "off_1" && row.content.includes("$180")));
    assert.ok(drafts.some((row) => row.kind === "faq" && row.title === "Do you ship?"));
    assert.ok(drafts.some((row) => row.kind === "policy" && row.title === "Returns"));
    assert.ok(drafts.some((row) => row.kind === "document" && row.sourceType === "document"));
  });
});

describe("V2 desk store foundations", () => {
  it("keeps Workspace.knowledge JSON as the live source of truth", async () => {
    const { store, workspaceA } = await twoWorkspaces();
    const knowledge = {
      ...emptyKnowledge("service"),
      name: "Harbor Repair",
    };
    await store.saveKnowledge(workspaceA.id, knowledge);
    const loaded = await store.getWorkspace(workspaceA.id);
    assert.equal(loaded?.knowledge?.name, "Harbor Repair");
    assert.equal((await store.listKnowledgeEntries(workspaceA.id)).length, 0);
  });

  it("supports knowledge CRUD, search, disable, and workspace isolation", async () => {
    const { store, workspaceA, workspaceB } = await twoWorkspaces();
    const shipping = await store.createKnowledgeEntry(workspaceA.id, {
      kind: "policy",
      title: "Shipping",
      content: "USPS from Oregon. $12 flat.",
      sourceType: "manual",
      sourceLabel: "Owner entry",
    });
    await store.createKnowledgeEntry(workspaceA.id, {
      kind: "faq",
      title: "Hours?",
      content: "Nine to five weekdays.",
    });
    await store.createKnowledgeEntry(workspaceB.id, {
      kind: "policy",
      title: "Shipping",
      content: "Inland same-day only.",
    });

    const found = await store.listKnowledgeEntries(workspaceA.id, { query: "usps" });
    assert.equal(found.length, 1);
    assert.equal(found[0]?.id, shipping.id);

    const disabled = await store.updateKnowledgeEntry(shipping.id, workspaceA.id, { enabled: false });
    assert.equal(disabled.enabled, false);
    assert.equal((await store.listKnowledgeEntries(workspaceA.id, { enabled: true })).length, 1);
    assert.equal(await store.getKnowledgeEntry(shipping.id, workspaceB.id), null);

    await store.deleteKnowledgeEntry(shipping.id, workspaceA.id);
    assert.equal(await store.getKnowledgeEntry(shipping.id, workspaceA.id), null);
  });

  it("adds inbox fields without breaking conversation identity", async () => {
    const { store, workspaceA } = await twoWorkspaces();
    const conversation = await store.createConversation({
      workspaceId: workspaceA.id,
      visitorKey: "visitor-1",
    });
    assert.equal(conversation.waitingOnHuman, false);
    assert.equal(conversation.inboxStatus, "open");
    assert.equal(conversation.customerIntent, "general_question");
    assert.equal(conversation.channel, "website");
    assert.equal(conversationIsUnread(conversation), true);

    await store.addMessage({
      workspaceId: workspaceA.id,
      conversationId: conversation.id,
      role: "visitor",
      content: "Need a quote for a tent",
      usageCounted: false,
    });
    const afterMessage = await store.getConversation(conversation.id, workspaceA.id);
    assert.ok(afterMessage);
    assert.ok(afterMessage.lastMessageAt.getTime() >= conversation.lastMessageAt.getTime());

    const updated = await store.updateConversation(conversation.id, workspaceA.id, {
      visitorName: "Pat",
      visitorEmail: "pat@example.com",
      customerIntent: "quote_request",
      aiSummary: "Visitor wants a tent quote.",
      detectedLanguage: "en",
    });
    assert.equal(updated.visitorName, "Pat");
    assert.equal(updated.customerIntent, "quote_request");
    const read = await store.markConversationRead(conversation.id, workspaceA.id, updated.lastMessageAt);
    assert.equal(conversationIsUnread(read), false);
  });

  it("isolates leads and rejects unknown statuses", async () => {
    const { store, workspaceA, workspaceB, ownerA } = await twoWorkspaces();
    const conversation = await store.createConversation({
      workspaceId: workspaceA.id,
      visitorKey: "v-lead",
    });
    const lead = await store.createLead(workspaceA.id, {
      conversationId: conversation.id,
      name: "Pat",
      email: "pat@example.com",
      interest: "Trail tent",
      request: "Can I get pricing?",
      intent: "pricing_inquiry",
      aiSummary: "Pricing question about the trail tent.",
    });
    assert.equal(lead.status, "new");
    assert.equal((await store.listLeads(workspaceB.id)).length, 0);
    assert.equal(await store.getLead(lead.id, workspaceB.id), null);
    await assert.rejects(
      () => store.createLead(workspaceA.id, { conversationId: "missing" }),
      (error: unknown) => error instanceof Error && error.message === "conversation_missing",
    );
    await assert.rejects(
      () => store.updateLead(lead.id, workspaceA.id, { status: "vip" as "new" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
    const qualified = await store.updateLead(lead.id, workspaceA.id, { status: "qualified" });
    assert.equal(qualified.status, "qualified");
    const notice = await store.addNotification({
      userId: ownerA.id,
      workspaceId: workspaceA.id,
      type: "qualified_lead",
      message: "A qualified lead is ready to review.",
      relatedType: "lead",
      relatedId: lead.id,
    });
    assert.equal(notice.relatedId, lead.id);
    const marked = await store.markNotificationRead(notice.id, ownerA.id, workspaceA.id);
    assert.ok(marked.readAt);
  });

  it("stores quote and appointment requests without confirming bookings", async () => {
    const { store, workspaceA, workspaceB } = await twoWorkspaces();
    const quote = await store.createQuoteRequest(workspaceA.id, {
      customerName: "Pat",
      email: "pat@example.com",
      productService: "Trail tent",
      requirements: "Two-person, ships this month",
    });
    assert.equal(quote.status, "requested");
    const appointment = await store.createAppointmentRequest(workspaceA.id, {
      customerName: "Pat",
      requestedService: "Fitting",
      preferredAt: "Tuesday afternoon",
    });
    assert.equal(appointment.status, "requested");
    assert.equal((await store.listQuoteRequests(workspaceB.id)).length, 0);
    await assert.rejects(
      () => store.updateAppointmentRequest(appointment.id, workspaceA.id, { status: "confirmed" as "requested" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
  });

  it("tracks unanswered questions and default widget AI identification", async () => {
    const { store, workspaceA } = await twoWorkspaces();
    const conversation = await store.createConversation({
      workspaceId: workspaceA.id,
      visitorKey: "v-q",
    });
    const question = await store.createUnansweredQuestion({
      workspaceId: workspaceA.id,
      conversationId: conversation.id,
      question: "Do you offer rush delivery to Juneau?",
      detectedLanguage: "en",
    });
    assert.equal(question.status, "open");
    const answered = await store.updateUnansweredQuestion(question.id, workspaceA.id, { status: "answered" });
    assert.equal(answered.status, "answered");
    assert.ok(answered.resolvedAt);

    const settings = await store.upsertWidgetSettings(workspaceA.id, {});
    assert.equal(settings.identifyAsAi, true);
    assert.equal(settings.position, "bottom-right");
    assert.equal(settings.collectPhone, false);
    assert.match(settings.welcomeMessage, /AI assistant/);
    assert.equal(DEFAULT_AI_IDENTIFICATION, "AI assistant");
    assert.match(DEFAULT_WIDGET_WELCOME, /AI assistant/);
    const moved = await store.upsertWidgetSettings(workspaceA.id, { position: "bottom-left" });
    assert.equal(moved.position, "bottom-left");
    assert.equal(moved.identifyAsAi, true);
  });

  it("keeps future integrations disconnected by default", async () => {
    const { store, workspaceA } = await twoWorkspaces();
    const shopify = await store.upsertIntegrationConnection({
      workspaceId: workspaceA.id,
      provider: "shopify",
    });
    assert.equal(shopify.status, "disconnected");
    const forced = await store.upsertIntegrationConnection({
      workspaceId: workspaceA.id,
      provider: "shopify",
      status: "connected",
    });
    assert.equal(forced.status, "disconnected");
    assert.equal((await store.listIntegrationConnections(workspaceA.id))[0]?.status, "disconnected");
  });

  it("computes overview counts only from stored records", async () => {
    const { store, workspaceA } = await twoWorkspaces();
    const conversation = await store.createConversation({
      workspaceId: workspaceA.id,
      visitorKey: "v-metrics",
    });
    await store.setConversationWaiting(conversation.id, workspaceA.id, true);
    await store.createLead(workspaceA.id, { status: "new", name: "Pat" });
    await store.createLead(workspaceA.id, { status: "qualified", name: "Kim" });
    await store.createUnansweredQuestion({ workspaceId: workspaceA.id, question: "Warranty on poles?" });
    await store.createQuoteRequest(workspaceA.id, { productService: "Tent" });
    await store.createAppointmentRequest(workspaceA.id, { requestedService: "Consult" });
    const counts = deskOverviewCounts({
      conversations: await store.listConversations(workspaceA.id),
      leads: await store.listLeads(workspaceA.id),
      unanswered: await store.listUnansweredQuestions(workspaceA.id),
      quotes: await store.listQuoteRequests(workspaceA.id),
      appointments: await store.listAppointmentRequests(workspaceA.id),
    });
    assert.equal(counts.conversationsTotal, 1);
    assert.equal(counts.conversationsNeedingHuman, 1);
    assert.equal(counts.leadsNew, 1);
    assert.equal(counts.leadsQualified, 1);
    assert.equal(counts.unansweredOpen, 1);
    assert.equal(counts.quoteRequestsOpen, 1);
    assert.equal(counts.appointmentRequestsOpen, 1);
  });

  it("maps reply intents onto customer intents without inventing purchase intent", () => {
    assert.equal(customerIntentFromReplyIntent("pricing"), "pricing_inquiry");
    assert.equal(customerIntentFromReplyIntent("appointments"), "appointment_request");
    assert.equal(customerIntentFromReplyIntent("hours"), "general_question");
    assert.equal(isHighIntent("purchase_intent"), true);
    assert.equal(isHighIntent("general_question"), false);
  });
});
