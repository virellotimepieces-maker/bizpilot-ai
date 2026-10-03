import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BillingError, type StripeLikeEvent } from "../billing/types";
import { BillingService } from "../billing/service";
import { MemoryBillingStore } from "../billing/memory-store";
import { applyStripeEvent } from "../billing/stripe-events";
import {
  filterLeads,
  findLeadForContact,
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

  it("keeps one workspace contact per email and ignores another workspace", async () => {
    const { store, workspace, user, service } = await paidWorkspace();
    const otherOwner = await store.createUser({
      email: "other-leads@example.com",
      passwordHash: "hash",
      name: "Other",
    });
    const other = await store.createWorkspace({ ownerUserId: otherOwner.id, name: "Inland" });
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: true });
    const form = await service.saveWidgetVisitorContact({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-form",
      name: "Pat",
      email: "pat@example.com",
    });
    const booked = await store.createConversation({ workspaceId: workspace.id, visitorKey: "v-book" });
    const otherConversation = await store.createConversation({ workspaceId: other.id, visitorKey: "v-other" });
    await service.captureBookingContact({
      workspaceId: workspace.id,
      userId: user.id,
      conversationId: booked.id,
      name: "Pat Rivera",
      email: "pat@example.com",
    });
    await service.captureBookingContact({
      workspaceId: other.id,
      userId: otherOwner.id,
      conversationId: otherConversation.id,
      name: "Pat Rivera",
      email: "pat@example.com",
    });
    const leads = await service.listWorkspaceLeads(workspace.id);
    assert.equal(leads.length, 1);
    assert.equal(leads[0]?.name, "Pat Rivera");
    assert.equal(leads[0]?.email, "pat@example.com");
    assert.equal(leads[0]?.conversationId, booked.id);
    assert.equal(leads[0]?.workspaceId, workspace.id);
    assert.notEqual(form.id, otherConversation.id);
    const inland = await store.listLeads(other.id);
    assert.equal(inland.length, 1);
    assert.equal(inland[0]?.workspaceId, other.id);
    assert.equal(findLeadForContact([...leads, ...inland], {
      workspaceId: workspace.id,
      email: "pat@example.com",
    })?.workspaceId, workspace.id);
    const again = await service.captureBookingContact({
      workspaceId: workspace.id,
      userId: user.id,
      conversationId: booked.id,
      name: "Pat Rivera",
      email: "pat@example.com",
    });
    assert.equal(again?.id, leads[0]?.id);
    assert.equal((await store.listLeads(workspace.id)).length, 1);
    assert.equal((await store.listNotifications(user.id, workspace.id)).filter((row) => row.type === "new_lead").length, 1);
  });

  it("syncs stored booking contacts once per email and skips availability-only visitors", async () => {
    const { store, workspace, user, service } = await paidWorkspace();
    const other = await store.createWorkspace({
      ownerUserId: (await store.createUser({
        email: "sync-other@example.com",
        passwordHash: "hash",
        name: "Sync",
      })).id,
      name: "Other Shop",
    });
    const first = await store.createConversation({ workspaceId: workspace.id, visitorKey: "sync-1" });
    const second = await store.createConversation({ workspaceId: workspace.id, visitorKey: "sync-2" });
    await store.createConversation({ workspaceId: workspace.id, visitorKey: "probe" });
    await store.createCalendarAppointment({
      workspaceId: workspace.id,
      conversationId: first.id,
      customerName: "Ada",
      email: "ada@example.com",
      service: "",
      startsAt: new Date("2026-10-09T13:00:00.000Z"),
      endsAt: new Date("2026-10-09T13:30:00.000Z"),
      timezone: "America/New_York",
      googleCalendarId: "primary",
      holdKey: "2026-10-09T13:00:00.000Z",
    });
    await store.createCalendarAppointment({
      workspaceId: workspace.id,
      conversationId: second.id,
      customerName: "Ada Lovelace",
      email: "ADA@example.com",
      service: "sizing",
      startsAt: new Date("2026-10-09T14:00:00.000Z"),
      endsAt: new Date("2026-10-09T14:30:00.000Z"),
      timezone: "America/New_York",
      googleCalendarId: "primary",
      holdKey: "2026-10-09T14:00:00.000Z",
    });
    await store.createCalendarAppointment({
      workspaceId: other.id,
      conversationId: null,
      customerName: "Other",
      email: "other@example.com",
      service: "",
      startsAt: new Date("2026-10-09T15:00:00.000Z"),
      endsAt: new Date("2026-10-09T15:30:00.000Z"),
      timezone: "America/New_York",
      googleCalendarId: "primary",
      holdKey: "2026-10-09T15:00:00.000Z",
    });
    await service.syncBookingContactsToLeads(workspace.id, user.id);
    await service.syncBookingContactsToLeads(workspace.id, user.id);
    const leads = await store.listLeads(workspace.id);
    assert.equal(leads.length, 1);
    assert.equal(leads[0]?.name, "Ada Lovelace");
    assert.equal(leads[0]?.email, "ada@example.com");
    assert.equal((await store.listLeads(other.id)).length, 0);
    assert.equal((await store.getConversation(first.id, workspace.id))?.visitorEmail, "ada@example.com");
  });
});
