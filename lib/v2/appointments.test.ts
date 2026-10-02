import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { BillingError, type StripeLikeEvent } from "../billing/types";
import { BillingService } from "../billing/service";
import { MemoryBillingStore } from "../billing/memory-store";
import { applyStripeEvent } from "../billing/stripe-events";
import {
  APPOINTMENT_DECLINED_HINT,
  APPOINTMENT_REQUEST_HINT,
  appointmentCounts,
  appointmentDisplayName,
  extractPreferredAt,
  extractRequestedService,
  filterAppointmentRequests,
  isAppointmentRequestQuestion,
  parseAppointmentPatch,
  serializeAppointmentRequest,
} from "./appointments";
import { APPOINTMENT_REQUEST_STATUSES } from "./enums";
import { isQuoteRequestQuestion } from "./quotes";
import { newAppointmentRequest } from "./records";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace() {
  const store = new MemoryBillingStore();
  const user = await store.createUser({
    email: "appointments@example.com",
    passwordHash: "hash",
    name: "Appointments",
  });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor" });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-11-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: "evt_appt_co",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_appt",
        mode: "subscription",
        customer: "cus_appt",
        subscription: "sub_appt",
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  } satisfies StripeLikeEvent);
  await applyStripeEvent(store, {
    id: "evt_appt_sub",
    type: "customer.subscription.updated",
    data: {
      object: {
        id: "sub_appt",
        customer: "cus_appt",
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

describe("Appointment request helpers", () => {
  it("detects booking language without treating quotes or hours as appointments", () => {
    assert.equal(isAppointmentRequestQuestion("How do I book an appointment?"), true);
    assert.equal(isAppointmentRequestQuestion("I'd like to book an appointment"), true);
    assert.equal(
      isAppointmentRequestQuestion("Can I schedule a visit for a fitting on Tuesday afternoon?"),
      true,
    );
    assert.equal(isAppointmentRequestQuestion("What are your hours?"), false);
    assert.equal(isAppointmentRequestQuestion("How do I get a quote?"), false);
    assert.equal(isAppointmentRequestQuestion("Can I book a tent?"), false);
    assert.equal(isQuoteRequestQuestion("I'd like to book an appointment"), false);
    assert.equal(
      extractRequestedService("Can I schedule a visit for a fitting on Tuesday afternoon?"),
      "fitting",
    );
    assert.equal(extractPreferredAt("Can I schedule a visit for a fitting on Tuesday afternoon?"), "Tuesday afternoon");
    assert.equal(extractPreferredAt("How do I book an appointment?"), "");
  });

  it("filters stored rows and rejects a confirmed status", () => {
    const rows = [
      newAppointmentRequest("ws", { customerName: "Pat", email: "pat@example.com", status: "requested" }),
      newAppointmentRequest("ws", { customerName: "Kim", email: "kim@example.com", status: "declined" }),
    ];
    assert.equal(filterAppointmentRequests(rows, { status: "requested" }).length, 1);
    assert.equal(filterAppointmentRequests(rows, { query: "kim@" }).length, 1);
    assert.deepEqual(appointmentCounts(rows), {
      total: 2,
      requested: 1,
      in_review: 0,
      declined: 1,
      closed: 0,
      open: 1,
    });
    assert.equal(appointmentDisplayName({ customerName: "", email: "pat@example.com" }), "pat@example.com");
    assert.equal(serializeAppointmentRequest(rows[0]).status, "requested");
    assert.equal(parseAppointmentPatch({ status: "in_review" }).status, "in_review");
    assert.throws(
      () => parseAppointmentPatch({ status: "confirmed" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
    assert.throws(
      () => parseAppointmentPatch({ preferredAt: "Tuesday 3pm" }),
      (error: unknown) => error instanceof BillingError && error.code === "invalid",
    );
  });
});

describe("Widget questions create appointment requests", () => {
  it("stores one open request per conversation and notifies the owner", async () => {
    const { store, workspace, user, service, start } = await paidWorkspace();
    const first = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-appt",
      question: "How do I book an appointment?",
      now: start,
      generate: async () => "I can pass an appointment request to the team. I do not book a calendar slot.",
    });
    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-appt",
      conversationId: first.conversationId,
      question: "Can I schedule a visit for a fitting on Tuesday afternoon?",
      now: start,
      generate: async () => "The team will review that request.",
    });
    const appointments = await service.listWorkspaceAppointmentRequests(workspace.id);
    assert.equal(appointments.length, 1);
    assert.equal(appointments[0].status, "requested");
    assert.equal(appointments[0].conversationId, first.conversationId);
    assert.equal(appointments[0].preferredAt, "Tuesday afternoon");
    const conversation = await store.getConversation(first.conversationId, workspace.id);
    assert.equal(conversation?.customerIntent, "appointment_request");
    const notices = await store.listNotifications(user.id, workspace.id);
    assert.equal(notices.filter((row) => row.type === "appointment_request").length, 1);
    assert.equal((await store.listQuoteRequests(workspace.id)).length, 0);
    assert.equal((await store.listLeads(workspace.id)).length, 0);
  });

  it("does not capture hours or quote questions as appointments", async () => {
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
      visitorKey: "v-quote",
      question: "How do I get a quote?",
      now: start,
      generate: async () => "The team reviews quote requests.",
    });
    assert.equal((await store.listAppointmentRequests(workspace.id)).length, 0);
    assert.equal((await store.listQuoteRequests(workspace.id)).length, 1);
  });

  it("fills contact on an existing request and keeps declined as owner-only", async () => {
    const { store, workspace, service, start } = await paidWorkspace();
    await store.upsertWidgetSettings(workspace.id, { leadCaptureEnabled: true });
    const chat = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-contact",
      question: "I'd like to book an appointment",
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
    const appointments = await store.listAppointmentRequests(workspace.id);
    assert.equal(appointments.length, 1);
    assert.equal(appointments[0].customerName, "Pat Rivera");
    assert.equal(appointments[0].email, "pat@example.com");
    const lead = (await store.listLeads(workspace.id))[0];
    assert.equal(appointments[0].leadId, lead.id);
    assert.equal(lead.intent, "appointment_request");
    const marked = await service.updateWorkspaceAppointmentRequest(workspace.id, appointments[0].id, {
      status: "declined",
      notes: "We are booked that week.",
    });
    assert.equal(marked.status, "declined");
    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-contact",
      conversationId: chat.conversationId,
      question: "Can I book an appointment next month instead?",
      now: start,
      generate: async () => "Another request is in for the team.",
    });
    assert.equal((await store.listAppointmentRequests(workspace.id)).length, 2);
    await assert.rejects(
      () => service.updateWorkspaceAppointmentRequest(workspace.id, "missing", { status: "closed" }),
      (error: unknown) => error instanceof BillingError && error.code === "not_found",
    );
  });

  it("keeps workspaces isolated and copy honest", async () => {
    const { store, workspace, service, start } = await paidWorkspace();
    const other = await store.createWorkspace({
      ownerUserId: (
        await store.createUser({
          email: "other-appt@example.com",
          passwordHash: "hash",
          name: "Other",
        })
      ).id,
      name: "Inland",
    });
    const result = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v-iso",
      question: "How do I book an appointment?",
      now: start,
      generate: async () => "The team reviews appointment requests.",
    });
    const appointment = (await store.listAppointmentRequests(workspace.id))[0];
    assert.equal((await store.listAppointmentRequests(other.id)).length, 0);
    await assert.rejects(
      () => service.updateWorkspaceAppointmentRequest(other.id, appointment.id, { status: "closed" }),
      (error: unknown) => error instanceof BillingError && error.code === "not_found",
    );
    assert.ok(result.conversationId);
    const ui = readFileSync("components/paid-appointments.tsx", "utf8");
    const sales = readFileSync("components/paid-sales.tsx", "utf8");
    const page = readFileSync("app/app/appointments/page.tsx", "utf8");
    const enums = APPOINTMENT_REQUEST_STATUSES.join(",");
    assert.match(ui, /No appointment requests stored yet/);
    assert.match(ui, /APPOINTMENT_REQUEST_HINT/);
    assert.match(ui, /APPOINTMENT_DECLINED_HINT/);
    assert.doesNotMatch(ui, /confirmed appointment|Start Free/i);
    assert.doesNotMatch(enums, /confirmed/);
    assert.match(sales, /\/app\/appointments/);
    assert.match(page, /PaidSales/);
    assert.doesNotMatch(page, /DeskPlaceholderPage/);
    assert.match(APPOINTMENT_REQUEST_HINT, /does not confirm a booking/);
    assert.match(APPOINTMENT_DECLINED_HINT, /not a calendar event/);
  });
});
