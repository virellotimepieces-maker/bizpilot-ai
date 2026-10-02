import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BillingError, type StripeLikeEvent } from "../billing/types";
import { BillingService } from "../billing/service";
import { MemoryBillingStore } from "../billing/memory-store";
import { applyStripeEvent } from "../billing/stripe-events";
import {
  filterLeads,
  leadCounts,
  leadDisplayName,
  parseLeadPatch,
  serializeLead,
} from "./leads";
import { newLead } from "./records";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace() {
  const store = new MemoryBillingStore();
  const user = await store.createUser({
    email: "leads@example.com",
    passwordHash: "hash",
    name: "Leads",
  });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor" });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: "evt_leads_co",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_leads",
        mode: "subscription",
        customer: "cus_leads",
        subscription: "sub_leads",
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  } satisfies StripeLikeEvent);
  await applyStripeEvent(store, {
    id: "evt_leads_sub",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_leads",
        customer: "cus_leads",
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
  return { store, user, workspace, service: new BillingService(store) };
}

describe("Lead helpers", () => {
  it("filters stored rows without inventing contacts", () => {
    const rows = [
      newLead("ws", { name: "Pat", email: "pat@example.com", status: "new" }),
      newLead("ws", { name: "Kim", email: "kim@example.com", status: "qualified" }),
    ];
    assert.equal(filterLeads(rows, { status: "qualified" }).length, 1);
    assert.equal(filterLeads(rows, { query: "pat@" }).length, 1);
    assert.deepEqual(leadCounts(rows), { total: 2, new: 1, qualified: 1, follow_up: 0 });
    assert.equal(leadDisplayName({ name: "", email: "pat@example.com" }), "pat@example.com");
    assert.equal(leadDisplayName({ name: "", email: "" }), "Unnamed visitor");
    const serialized = serializeLead(rows[0]);
    assert.equal(serialized.status, "new");
    assert.match(serialized.createdAt, /T/);
  });

  it("rejects unknown statuses and empty patches", () => {
    assert.equal(parseLeadPatch({ status: "follow_up" }).status, "follow_up");
    assert.throws(
      () => parseLeadPatch({ status: "vip" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
    assert.throws(
      () => parseLeadPatch({}),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
  });
});

describe("Widget contact creates a Lead", () => {
  it("upserts one lead per conversation and notifies the owner", async () => {
    const { store, workspace, user, service } = await paidWorkspace();
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: true });
    const first = await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-1",
      name: "Pat",
      email: "pat@example.com",
    });
    const second = await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-1",
      conversationId: first.id,
      name: "Pat Rivera",
      email: "pat@example.com",
    });
    assert.equal(first.id, second.id);
    const leads = await service.listWorkspaceLeads(workspace.id);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].name, "Pat Rivera");
    assert.equal(leads[0].conversationId, first.id);
    const notices = await store.listNotifications(user.id, workspace.id);
    assert.equal(notices.filter((row) => row.type === "new_lead").length, 1);
  });

  it("does not mark converted as a payment and keeps workspaces isolated", async () => {
    const { store, workspace, service } = await paidWorkspace();
    const other = await store.createWorkspace({
      ownerUserId: (await store.createUser({
        email: "other@example.com",
        passwordHash: "hash",
        name: "Other",
      })).id,
      name: "Inland",
    });
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: true });
    const conversation = await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-2",
      email: "pat@example.com",
    });
    const lead = (await store.listLeads(workspace.id))[0];
    const updated = await service.updateWorkspaceLead(workspace.id, lead.id, { status: "converted" });
    assert.equal(updated.status, "converted");
    assert.equal((await store.listLeads(other.id)).length, 0);
    await assert.rejects(
      () => service.updateWorkspaceLead(other.id, lead.id, { status: "qualified" }),
      (error: unknown) => error instanceof BillingError && error.code === "not_found",
    );
    const ui = readFileSync("components/paid-leads.tsx", "utf8");
    assert.match(ui, /not a Stripe payment/);
    assert.match(ui, /No leads stored yet/);
    assert.doesNotMatch(ui, /Start Free/i);
    assert.equal(conversation.visitorEmail, "pat@example.com");
  });

  it("notifies qualified without creating quote or appointment rows", async () => {
    const { store, workspace, user, service } = await paidWorkspace();
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: true });
    await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-3",
      name: "Kim",
      email: "kim@example.com",
    });
    const lead = (await store.listLeads(workspace.id))[0];
    await service.updateWorkspaceLead(workspace.id, lead.id, { status: "qualified", notes: "Call Tuesday." });
    const notices = await store.listNotifications(user.id, workspace.id);
    assert.ok(notices.some((row) => row.type === "qualified_lead"));
    assert.equal((await store.listQuoteRequests(workspace.id)).length, 0);
    assert.equal((await store.listAppointmentRequests(workspace.id)).length, 0);
    const page = readFileSync("app/app/leads/page.tsx", "utf8");
    assert.match(page, /PaidSales/);
    assert.doesNotMatch(page, /DeskPlaceholderPage/);
  });
});
