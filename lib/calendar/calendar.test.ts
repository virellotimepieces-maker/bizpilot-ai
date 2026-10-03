import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BillingService } from "@/lib/billing/service";
import { MemoryBillingStore } from "@/lib/billing/memory-store";
import { applyStripeEvent } from "@/lib/billing/stripe-events";
import { BillingError, type StripeLikeEvent } from "@/lib/billing/types";
import { decryptSecret, encryptSecret } from "@/lib/gmail/token-crypto";
import { serializeWorkspaceIntegrations } from "@/lib/v2/integrations";
import { publicGmailStatus } from "@/lib/gmail/public";
import { publicShopifyStatus } from "@/lib/shopify/public";
import { buildAvailableSlots, requestedWindow, zonedTimeToUtc } from "./availability";
import { DISCONNECTED_CALENDAR_REPLY, handleCalendarWidgetTurn } from "./booking";
import { sendBookingConfirmation } from "./confirmation";
import { CALENDAR_SCOPES, calendarCallbackUrl, googleCalendarAuthUrl } from "./config";
import { createCalendarOAuthState, readCalendarOAuthState } from "./oauth-state";
import { assertNoCalendarSecrets, publicCalendarStatus } from "./public";
import { parseCalendarSettingsInput } from "./settings";
import type { CalendarBookingSettingsRecord } from "./types";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function paidWorkspace(name: string, email: string) {
  const store = new MemoryBillingStore();
  const user = await store.createUser({ email, passwordHash: "hash", name });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name });
  const start = new Date("2026-09-01T00:00:00Z");
  const end = new Date("2026-12-01T00:00:00Z");
  await applyStripeEvent(store, {
    id: `evt_${email}_co`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${email}`,
        mode: "subscription",
        customer: `cus_${email}`,
        subscription: `sub_${email}`,
        client_reference_id: user.id,
        metadata: { userId: user.id, workspaceId: workspace.id },
      },
    },
  } satisfies StripeLikeEvent);
  await applyStripeEvent(store, {
    id: `evt_${email}_sub`,
    type: "customer.subscription.updated",
    data: {
      object: {
        id: `sub_${email}`,
        customer: `cus_${email}`,
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

function settings(patch: Partial<CalendarBookingSettingsRecord> = {}): CalendarBookingSettingsRecord {
  return {
    id: "settings",
    workspaceId: "workspace",
    durationMinutes: 30,
    availableDays: ["mon", "tue", "wed", "thu", "fri"],
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    timezone: "America/New_York",
    minNoticeMinutes: 0,
    bufferMinutes: 0,
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
    ...patch,
  };
}

function googleFetch(input: { busy?: { start: string; end: string }[]; calendarId?: string }) {
  const calls: { url: string; authorization: string; body: unknown }[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    calls.push({ url: String(url), authorization: headers.get("authorization") ?? "", body });
    if (String(url).includes("freeBusy")) {
      const calendarId = input.calendarId ?? "primary";
      return new Response(
        JSON.stringify({ calendars: { [calendarId]: { busy: input.busy ?? [] } } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (String(url).includes("/events")) {
      return new Response(JSON.stringify({ id: `evt_${calls.length}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };
  return { fetchImpl, calls };
}

describe("Google Calendar OAuth", () => {
  it("requests calendar scopes for one workspace and hides the client secret", async () => {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = previous && previous.length >= 16 ? previous : "test-auth-secret-value";
    const url = googleCalendarAuthUrl({
      clientId: "calendar-client.apps.googleusercontent.com",
      redirectUri: calendarCallbackUrl("https://app.example"),
      state: "signed-state",
    });
    assert.equal(calendarCallbackUrl("https://app.example/"), "https://app.example/api/app/calendar/callback");
    assert.match(url, /access_type=offline/);
    assert.match(url, /prompt=consent/);
    assert.match(url, /include_granted_scopes=true/);
    assert.doesNotMatch(url, /client_secret|gmail\.readonly|gmail\.send/);
    for (const scope of CALENDAR_SCOPES) {
      assert.ok(url.includes(encodeURIComponent(scope)));
    }
    const state = await createCalendarOAuthState({
      userId: "user-a",
      workspaceId: "workspace-a",
      nonce: "nonce-a",
      returnTo: "/app/integrations",
    });
    const read = await readCalendarOAuthState(state);
    assert.equal(read?.workspaceId, "workspace-a");
    assert.equal(read?.userId, "user-a");
    const gmailState = await import("@/lib/gmail/oauth-state").then((mod) =>
      mod.createGmailOAuthState({
        userId: "user-a",
        workspaceId: "workspace-a",
        nonce: "nonce-a",
        returnTo: "/app/integrations",
      }),
    );
    assert.equal(await readCalendarOAuthState(gmailState), null);
    process.env.AUTH_SECRET = previous;
  });

  it("publishes connection status without credentials and disconnects only that workspace", async () => {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = previous && previous.length >= 16 ? previous : "test-auth-secret-value";
    const { store, workspace, service } = await paidWorkspace("North", "north-calendar@example.com");
    const other = await store.createWorkspace({ ownerUserId: (await store.createUser({
      email: "south-calendar@example.com",
      passwordHash: "hash",
      name: "South",
    })).id, name: "South" });
    await store.upsertGoogleCalendarConnection({
      workspaceId: workspace.id,
      googleEmail: "owner-a@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-a"),
      encryptedAccessToken: encryptSecret("access-a"),
      accessTokenExpiresAt: new Date("2026-10-09T18:00:00Z"),
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "cal-a",
      calendarSummary: "North appointments",
    });
    await store.upsertGoogleCalendarConnection({
      workspaceId: other.id,
      googleEmail: "owner-b@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-b"),
      encryptedAccessToken: encryptSecret("access-b"),
      accessTokenExpiresAt: new Date("2026-10-09T18:00:00Z"),
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "cal-b",
      calendarSummary: "South appointments",
    });
    const settings = await store.upsertCalendarBookingSettings({
      workspaceId: workspace.id,
      durationMinutes: 30,
      availableDays: ["mon", "tue", "wed", "thu", "fri"],
      startMinutes: 9 * 60,
      endMinutes: 17 * 60,
      timezone: "America/New_York",
      minNoticeMinutes: 60,
      bufferMinutes: 15,
    });
    const status = publicCalendarStatus(await store.getGoogleCalendarConnection(workspace.id), settings);
    assert.equal(status.connected, true);
    assert.equal(status.googleEmail, "owner-a@gmail.com");
    assert.equal(status.calendarSummary, "North appointments");
    assert.equal(status.settings?.timezone, "America/New_York");
    assert.equal(status.settings?.bufferMinutes, 15);
    assertNoCalendarSecrets(status);
    const snapshot = await service.listWorkspaceIntegrations(workspace.id);
    const serialized = serializeWorkspaceIntegrations({
      ...snapshot,
      gmail: { ...publicGmailStatus(null), label: snapshot.gmail.label, href: snapshot.gmail.href },
      shopify: { ...publicShopifyStatus(null), label: snapshot.shopify.label },
    });
    assert.equal(serialized.calendar.googleEmail, "owner-a@gmail.com");
    assert.doesNotMatch(JSON.stringify(serialized), /refresh-a|access-a|encrypted/);
    await store.deleteGoogleCalendarConnection(workspace.id);
    assert.equal(await store.getGoogleCalendarConnection(workspace.id), null);
    assert.equal((await store.getGoogleCalendarConnection(other.id))?.calendarId, "cal-b");
    assert.equal((await store.getCalendarBookingSettings(other.id)), null);
    process.env.AUTH_SECRET = previous;
  });
});

describe("Calendar availability", () => {
  it("keeps Friday afternoon slots in the business timezone and skips busy time", () => {
    const now = new Date("2026-10-08T15:00:00.000Z");
    const window = requestedWindow("Do you have anything available Friday afternoon?", now, "America/New_York");
    assert.ok(window);
    assert.equal(zonedTimeToUtc({ year: 2026, month: 10, day: 9, hour: 12, minute: 0 }, "America/New_York").toISOString(), "2026-10-09T16:00:00.000Z");
    const slots = buildAvailableSlots({
      now,
      settings: settings(),
      busy: [{ start: new Date("2026-10-09T17:00:00.000Z"), end: new Date("2026-10-09T17:30:00.000Z") }],
      window,
    });
    assert.ok(slots.some((slot) => slot.start === "2026-10-09T16:00:00.000Z"));
    assert.ok(!slots.some((slot) => slot.start === "2026-10-09T17:00:00.000Z"));
    assert.ok(slots.every((slot) => slot.start >= "2026-10-09T16:00:00.000Z" && slot.start < "2026-10-09T21:00:00.000Z"));
  });

  it("applies minimum notice and the buffer between appointments", () => {
    const now = new Date("2026-10-09T13:00:00.000Z");
    const slots = buildAvailableSlots({
      now,
      settings: settings({ minNoticeMinutes: 120, bufferMinutes: 30, durationMinutes: 30 }),
      busy: [],
      window: requestedWindow("Are you available today?", now, "America/New_York"),
    });
    assert.equal(slots[0]?.start, "2026-10-09T15:00:00.000Z");
    assert.equal(slots[1]?.start, "2026-10-09T16:00:00.000Z");
  });

  it("rejects booking hours that do not fit the duration", () => {
    assert.throws(
      () =>
        parseCalendarSettingsInput({
          durationMinutes: 60,
          availableDays: [],
          startTime: "09:00",
          endTime: "09:30",
          timezone: "Not/AZone",
          minNoticeMinutes: 60,
          bufferMinutes: 0,
        }),
      BillingError,
    );
  });
});

describe("Calendar booking", () => {
  it("books a named slot on the workspace calendar and refuses a second booking of that time", async () => {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = previous && previous.length >= 16 ? previous : "test-auth-secret-value";
    const { store, workspace } = await paidWorkspace("Harbor", "harbor-calendar@example.com");
    const otherUser = await store.createUser({
      email: "other-calendar@example.com",
      passwordHash: "hash",
      name: "Other",
    });
    const other = await store.createWorkspace({ ownerUserId: otherUser.id, name: "Other" });
    await store.upsertGoogleCalendarConnection({
      workspaceId: workspace.id,
      googleEmail: "harbor@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-harbor"),
      encryptedAccessToken: encryptSecret("access-harbor"),
      accessTokenExpiresAt: new Date("2026-10-10T18:00:00.000Z"),
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "harbor-calendar",
      calendarSummary: "Harbor",
    });
    await store.upsertGoogleCalendarConnection({
      workspaceId: other.id,
      googleEmail: "other@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-other"),
      encryptedAccessToken: encryptSecret("access-other"),
      accessTokenExpiresAt: new Date("2026-10-10T18:00:00.000Z"),
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "other-calendar",
      calendarSummary: "Other",
    });
    const hours = settings();
    await store.upsertCalendarBookingSettings({
      workspaceId: workspace.id,
      durationMinutes: hours.durationMinutes,
      availableDays: hours.availableDays,
      startMinutes: hours.startMinutes,
      endMinutes: hours.endMinutes,
      timezone: hours.timezone,
      minNoticeMinutes: hours.minNoticeMinutes,
      bufferMinutes: hours.bufferMinutes,
    });
    const google = googleFetch({
      calendarId: "harbor-calendar",
      busy: [{ start: "2026-10-09T17:00:00.000Z", end: "2026-10-09T17:30:00.000Z" }],
    });
    const now = new Date("2026-10-08T15:00:00.000Z");
    const asked = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-a",
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(asked?.answer ?? "", /Choose one/);
    assert.doesNotMatch(asked?.answer ?? "", /email/i);
    assert.ok((asked?.sources.length ?? 0) > 0);
    assert.ok(asked?.sources.every((source) => source.url.startsWith("slot:")));
    assert.ok(asked?.sources.every((source) => source.slotStart?.startsWith("2026-10-09")));
    assert.ok(!asked?.sources.some((source) => source.slotStart === "2026-10-09T17:00:00.000Z"));
    const slot = asked?.sources[0];
    assert.ok(slot?.slotStart);
    const askedAgain = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-b",
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.ok(askedAgain?.sources.some((source) => source.slotStart === slot?.slotStart));
    const held = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-a",
      conversationId: asked?.conversationId,
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(held?.answer ?? "", /name and email/i);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, 0);
    const booked = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-a",
      conversationId: asked?.conversationId,
      question: "Ada Lovelace ada@example.com for a sizing",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(booked?.answer ?? "", /You're booked/);
    assert.match(booked?.answer ?? "", /confirmation email could not be sent/);
    assert.doesNotMatch(booked?.answer ?? "", /https?:\/\//);
    const saved = await store.listCalendarAppointments(workspace.id);
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.email, "ada@example.com");
    assert.equal(saved[0]?.googleCalendarId, "harbor-calendar");
    assert.equal(saved[0]?.workspaceId, workspace.id);
    assert.equal((await store.listCalendarAppointments(other.id)).length, 0);
    const createCall = google.calls.find((call) => call.url.includes("/events"));
    assert.ok(createCall);
    assert.match(createCall.url, /calendars\/harbor-calendar\/events/);
    assert.match(createCall.authorization, /access-harbor/);
    assert.doesNotMatch(JSON.stringify(google.calls), /other-calendar|access-other/);
    const repeat = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-b",
      conversationId: askedAgain?.conversationId,
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(repeat?.answer ?? "", /just taken|no open times/i);
    assert.equal((await store.listCalendarAppointments(workspace.id)).length, 1);
    const nextAsk = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-a",
      conversationId: asked?.conversationId,
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    const nextSlot = nextAsk?.sources.find((source) => source.slotStart !== slot?.slotStart);
    assert.ok(nextSlot?.slotStart);
    const eventsBefore = google.calls.filter((call) => call.url.includes("/events")).length;
    const unconfirmed = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-a",
      conversationId: asked?.conversationId,
      question: nextSlot?.title ?? "",
      slotStart: nextSlot?.slotStart,
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(unconfirmed?.answer ?? "", /name and email/i);
    assert.doesNotMatch(unconfirmed?.answer ?? "", /ada@example.com/);
    assert.equal((await store.listCalendarAppointments(workspace.id)).length, 1);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, eventsBefore);
    const reused = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-a",
      conversationId: asked?.conversationId,
      question: "yes",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(reused?.answer ?? "", /name and email/i);
    assert.doesNotMatch(reused?.answer ?? "", /ada@example.com/);
    assert.equal((await store.listCalendarAppointments(workspace.id)).length, 1);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, eventsBefore);
    const second = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-a",
      conversationId: asked?.conversationId,
      question: "Jordan Lee jordan@example.com",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(second?.answer ?? "", /You're booked for/);
    const rows = await store.listCalendarAppointments(workspace.id);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((row) => row.email === "ada@example.com").length, 1);
    assert.equal(rows.find((row) => row.email === "jordan@example.com")?.customerName, "Jordan Lee");
    const sentence = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-before",
      question: "Before I give my name and email, please show me the available appointment times for tomorrow.",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(sentence?.answer ?? "", /Choose one|open times/i);
    const sentenceSlot = sentence?.sources[0];
    const sentenceHeld = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-before",
      conversationId: sentence?.conversationId,
      question: sentenceSlot?.title ?? "",
      slotStart: sentenceSlot?.slotStart,
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(sentenceHeld?.answer ?? "", /name and email/i);
    assert.doesNotMatch(sentenceHeld?.answer ?? "", /\bBefore\b/);
    process.env.AUTH_SECRET = previous;
  });

  it("offers the next open day when the requested day is fully booked", async () => {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = previous && previous.length >= 16 ? previous : "test-auth-secret-value";
    const { store, workspace } = await paidWorkspace("Harbor Next", "harbor-next@example.com");
    await store.upsertGoogleCalendarConnection({
      workspaceId: workspace.id,
      googleEmail: "harbor@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-harbor"),
      encryptedAccessToken: encryptSecret("access-harbor"),
      accessTokenExpiresAt: new Date("2026-10-20T18:00:00.000Z"),
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "harbor-calendar",
      calendarSummary: "Harbor",
    });
    const hours = settings();
    await store.upsertCalendarBookingSettings({
      workspaceId: workspace.id,
      durationMinutes: hours.durationMinutes,
      availableDays: hours.availableDays,
      startMinutes: hours.startMinutes,
      endMinutes: hours.endMinutes,
      timezone: hours.timezone,
      minNoticeMinutes: hours.minNoticeMinutes,
      bufferMinutes: hours.bufferMinutes,
    });
    const google = googleFetch({
      calendarId: "harbor-calendar",
      busy: [{ start: "2026-10-09T13:00:00.000Z", end: "2026-10-09T21:00:00.000Z" }],
    });
    const turn = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-next",
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now: new Date("2026-10-08T15:00:00.000Z"),
      fetchImpl: google.fetchImpl,
    });
    assert.match(turn?.answer ?? "", /no open times then/i);
    assert.doesNotMatch(turn?.answer ?? "", /email/i);
    assert.ok(turn?.sources.some((source) => source.slotStart === "2026-10-12T13:00:00.000Z"));
    assert.ok(!turn?.sources.some((source) => source.slotStart?.startsWith("2026-10-09")));
    const monday = requestedWindow("next Monday", new Date("2026-10-08T15:00:00.000Z"), "America/New_York");
    assert.equal(monday?.start.toISOString(), "2026-10-12T04:00:00.000Z");
    process.env.AUTH_SECRET = previous;
  });

  it("does not invent times when calendar is disconnected", async () => {
    const { store, workspace } = await paidWorkspace("Plain", "plain-calendar@example.com");
    const other = await paidWorkspace("Separate", "separate-calendar@example.com");
    const turn = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-c",
      question: "Are you available tomorrow?",
      now: new Date("2026-10-08T15:00:00.000Z"),
    });
    assert.equal(turn?.answer, DISCONNECTED_CALENDAR_REPLY);
    assert.equal(turn?.sources.length, 0);
    assert.doesNotMatch(turn?.answer ?? "", /\b\d{1,2}:\d{2}\b|you're booked|appointment is confirmed/i);
    const booking = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-d",
      question: "I'd like to book an appointment.",
      now: new Date("2026-10-08T15:00:00.000Z"),
    });
    assert.equal(booking?.answer, DISCONNECTED_CALENDAR_REPLY);
    const requests = await store.listAppointmentRequests(workspace.id);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.workspaceId, workspace.id);
    assert.equal((await other.store.listAppointmentRequests(other.workspace.id)).length, 0);
    const ignored = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-c",
      conversationId: turn?.conversationId,
      question: "What straps do you sell?",
    });
    assert.equal(ignored, null);
  });

  it("does not reuse a completed booking's name or email when the same chat selects another time", async () => {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = previous && previous.length >= 16 ? previous : "test-auth-secret-value";
    const { store, workspace } = await paidWorkspace("Harbor Held", "harbor-held@example.com");
    await store.upsertGoogleCalendarConnection({
      workspaceId: workspace.id,
      googleEmail: "harbor@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-harbor"),
      encryptedAccessToken: encryptSecret("access-harbor"),
      accessTokenExpiresAt: new Date("2026-10-10T18:00:00.000Z"),
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "harbor-calendar",
      calendarSummary: "Harbor",
    });
    const hours = settings();
    await store.upsertCalendarBookingSettings({
      workspaceId: workspace.id,
      durationMinutes: hours.durationMinutes,
      availableDays: hours.availableDays,
      startMinutes: hours.startMinutes,
      endMinutes: hours.endMinutes,
      timezone: hours.timezone,
      minNoticeMinutes: hours.minNoticeMinutes,
      bufferMinutes: hours.bufferMinutes,
    });
    const conversation = await store.createConversation({ workspaceId: workspace.id, visitorKey: "visitor-held" });
    const previousSlot = {
      start: "2026-10-09T13:00:00.000Z",
      end: "2026-10-09T13:30:00.000Z",
      label: "Fri, Oct 9, 9:00 AM",
    };
    await store.upsertCalendarBookingSession({
      workspaceId: workspace.id,
      conversationId: conversation.id,
      customerName: "Before",
      email: "virellotimepieces@gmail.com",
      service: "sizing",
      offeredSlots: [previousSlot],
      status: "booked",
    });
    const google = googleFetch({ calendarId: "harbor-calendar" });
    const now = new Date("2026-10-08T15:00:00.000Z");
    const held = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-held",
      conversationId: conversation.id,
      question: previousSlot.label,
      slotStart: previousSlot.start,
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(held?.answer ?? "", /name and email/i);
    assert.doesNotMatch(held?.answer ?? "", /virellotimepieces@gmail.com|Before/);
    assert.doesNotMatch(held?.answer ?? "", /revoked or expired/);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, 0);
    assert.equal((await store.listCalendarAppointments(workspace.id)).length, 0);
    const booked = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-held",
      conversationId: conversation.id,
      question: "Pat Kim pat@example.com for a repair",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(booked?.answer ?? "", /You're booked for Fri, Oct 9, 9:00 AM/);
    assert.doesNotMatch(booked?.answer ?? "", /virellotimepieces@gmail.com/);
    assert.doesNotMatch(booked?.answer ?? "", /revoked or expired/);
    const first = await store.listCalendarAppointments(workspace.id);
    assert.equal(first.length, 1);
    assert.equal(first[0]?.email, "pat@example.com");
    assert.equal(first[0]?.customerName, "Pat Kim");
    const asked = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-held",
      conversationId: conversation.id,
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.doesNotMatch(asked?.answer ?? "", /pat@example.com|virellotimepieces@gmail.com/);
    const nextSlot = asked?.sources.find((source) => source.slotStart !== previousSlot.start);
    assert.ok(nextSlot?.slotStart);
    const eventsBefore = google.calls.filter((call) => call.url.includes("/events")).length;
    const secondHeld = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-held",
      conversationId: conversation.id,
      question: nextSlot?.title ?? "",
      slotStart: nextSlot?.slotStart,
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(secondHeld?.answer ?? "", /name and email/i);
    assert.doesNotMatch(secondHeld?.answer ?? "", /pat@example.com/);
    assert.equal((await store.listCalendarAppointments(workspace.id)).length, 1);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, eventsBefore);
    const second = await handleCalendarWidgetTurn({
      store,
      widgetKey: workspace.widgetKey,
      visitorKey: "visitor-held",
      conversationId: conversation.id,
      question: "Grace Hopper grace@example.com",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(second?.answer ?? "", /You're booked/);
    assert.doesNotMatch(second?.answer ?? "", /pat@example.com|virellotimepieces@gmail.com/);
    const rows = await store.listCalendarAppointments(workspace.id);
    assert.equal(rows.length, 2);
    assert.equal(rows.filter((row) => row.email === "pat@example.com").length, 1);
    assert.equal(rows.find((row) => row.email === "grace@example.com")?.customerName, "Grace Hopper");
    assert.equal(rows.find((row) => row.email === "virellotimepieces@gmail.com"), undefined);
    process.env.AUTH_SECRET = previous;
  });
});

describe("Booking confirmation email", () => {
  const now = new Date("2026-10-08T15:00:00.000Z");

  async function readyWorkspace(email: string) {
    const previous = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = previous && previous.length >= 16 ? previous : "test-auth-secret-value";
    const { store, workspace } = await paidWorkspace("Harbor", email);
    await store.upsertGoogleCalendarConnection({
      workspaceId: workspace.id,
      googleEmail: "calendar@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-calendar"),
      encryptedAccessToken: encryptSecret("access-calendar"),
      accessTokenExpiresAt: new Date("2026-10-10T18:00:00.000Z"),
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "harbor-calendar",
      calendarSummary: "Harbor",
    });
    await store.upsertGmailConnection({
      workspaceId: workspace.id,
      googleEmail: "harbor@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-gmail"),
      encryptedAccessToken: encryptSecret("access-gmail"),
      accessTokenExpiresAt: new Date("2026-10-10T18:00:00.000Z"),
      scopes: "openid https://www.googleapis.com/auth/gmail.send",
      status: "connected",
    });
    const hours = settings();
    await store.upsertCalendarBookingSettings({
      workspaceId: workspace.id,
      durationMinutes: hours.durationMinutes,
      availableDays: hours.availableDays,
      startMinutes: hours.startMinutes,
      endMinutes: hours.endMinutes,
      timezone: hours.timezone,
      minNoticeMinutes: hours.minNoticeMinutes,
      bufferMinutes: hours.bufferMinutes,
    });
    return {
      store,
      workspace,
      restore: () => {
        process.env.AUTH_SECRET = previous;
      },
    };
  }

  function fetchFor(eventsStatus = 200, sendStatus = 200) {
    const calls: { url: string; authorization: string; body: unknown }[] = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      const headers = new Headers(init?.headers);
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      calls.push({ url: String(url), authorization: headers.get("authorization") ?? "", body });
      if (String(url).includes("freeBusy")) {
        return new Response(JSON.stringify({ calendars: { "harbor-calendar": { busy: [] } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (String(url).includes("/events")) {
        return new Response(eventsStatus === 200 ? JSON.stringify({ id: "evt_confirmed" }) : "{}", {
          status: eventsStatus,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (String(url).includes("/messages/send")) {
        return new Response(JSON.stringify({ id: "msg_confirmed" }), {
          status: sendStatus,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("{}", { status: 404 });
    };
    return { fetchImpl, calls };
  }

  async function book(setup: Awaited<ReturnType<typeof readyWorkspace>>, fetchImpl: typeof fetch) {
    const asked = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-mail",
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl,
    });
    const slot = asked?.sources[0];
    await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-mail",
      conversationId: asked?.conversationId,
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      now,
      fetchImpl,
    });
    return handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-mail",
      conversationId: asked?.conversationId,
      question: "Ada Lovelace ada@example.com for a sizing",
      now,
      fetchImpl,
    });
  }

  it("sends one Gmail confirmation after the calendar event is created", async () => {
    const setup = await readyWorkspace("harbor-mail@example.com");
    const google = fetchFor();
    const booked = await book(setup, google.fetchImpl);
    assert.match(booked?.answer ?? "", /You're booked/);
    assert.match(booked?.answer ?? "", /confirmation email was sent to ada@example.com/);
    assert.doesNotMatch(booked?.answer ?? "", /could not be sent/);
    const eventIndex = google.calls.findIndex((call) => call.url.includes("/events"));
    const sendIndex = google.calls.findIndex((call) => call.url.includes("/messages/send"));
    assert.ok(eventIndex >= 0 && sendIndex > eventIndex);
    const send = google.calls[sendIndex];
    assert.match(send.authorization, /Bearer access-gmail/);
    assert.doesNotMatch(send.authorization, /access-calendar/);
    const raw = (send.body as { raw?: string }).raw ?? "";
    const rfc822 = Buffer.from(raw, "base64url").toString("utf8");
    assert.match(rfc822, /To: ada@example.com/);
    assert.match(rfc822, /From: harbor@gmail.com/);
    assert.match(rfc822, /Subject: Appointment confirmed - Harbor/);
    assert.match(rfc822, /Friday, October 9, 2026/);
    assert.match(rfc822, /9:00 AM/);
    assert.match(rfc822, /Timezone: America\/New_York/);
    assert.match(rfc822, /Duration: 30 minutes/);
    assert.match(rfc822, /Details: sizing/);
    const saved = await setup.store.listCalendarAppointments(setup.workspace.id);
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.googleEventId, "evt_confirmed");
    assert.ok(saved[0]?.confirmationSentAt);
    const again = await sendBookingConfirmation({
      store: setup.store,
      workspace: setup.workspace,
      appointment: saved[0]!,
      fetchImpl: google.fetchImpl,
    });
    assert.equal(again, false);
    assert.equal(google.calls.filter((call) => call.url.includes("/messages/send")).length, 1);
    setup.restore();
  });

  it("books a second customer in the same conversation without reusing the first email", async () => {
    const setup = await readyWorkspace("harbor-mail-second@example.com");
    const google = fetchFor();
    await book(setup, google.fetchImpl);
    const first = (await setup.store.listCalendarAppointments(setup.workspace.id))[0];
    assert.equal(first?.email, "ada@example.com");
    const asked = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-mail",
      conversationId: first?.conversationId ?? "",
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    const slot = asked?.sources.find((source) => source.slotStart !== first?.startsAt.toISOString());
    assert.ok(slot?.slotStart);
    const eventsBefore = google.calls.filter((call) => call.url.includes("/events")).length;
    const sendsBefore = google.calls.filter((call) => call.url.includes("/messages/send")).length;
    const held = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-mail",
      conversationId: first?.conversationId ?? "",
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(held?.answer ?? "", /name and email/i);
    assert.doesNotMatch(held?.answer ?? "", /ada@example.com/);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, eventsBefore);
    assert.equal(google.calls.filter((call) => call.url.includes("/messages/send")).length, sendsBefore);
    assert.equal((await setup.store.listCalendarAppointments(setup.workspace.id)).length, 1);
    const second = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-mail",
      conversationId: first?.conversationId ?? "",
      question: "Grace Hopper grace@example.com for a repair",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(second?.answer ?? "", /confirmation email was sent to grace@example.com/);
    assert.doesNotMatch(second?.answer ?? "", /ada@example.com/);
    const sends = google.calls.filter((call) => call.url.includes("/messages/send"));
    assert.equal(sends.length, sendsBefore + 1);
    const rfc822 = Buffer.from((sends.at(-1)?.body as { raw?: string }).raw ?? "", "base64url").toString("utf8");
    assert.match(rfc822, /To: grace@example.com/);
    assert.doesNotMatch(rfc822, /To: ada@example.com/);
    const saved = await setup.store.listCalendarAppointments(setup.workspace.id);
    assert.equal(saved.length, 2);
    assert.equal(saved.filter((row) => row.email === "ada@example.com").length, 1);
    assert.equal(saved.find((row) => row.email === "grace@example.com")?.customerName, "Grace Hopper");
    setup.restore();
  });

  it("tells the customer when the calendar event exists but Gmail rejects the confirmation", async () => {
    const setup = await readyWorkspace("harbor-mail-send-fail@example.com");
    const google = fetchFor(200, 500);
    const booked = await book(setup, google.fetchImpl);
    assert.match(booked?.answer ?? "", /You're booked/);
    assert.match(booked?.answer ?? "", /confirmation email could not be sent/);
    assert.doesNotMatch(booked?.answer ?? "", /confirmation email was sent/);
    assert.equal(google.calls.filter((call) => call.url.includes("/messages/send")).length, 1);
    const saved = await setup.store.listCalendarAppointments(setup.workspace.id);
    assert.equal(saved.length, 1);
    assert.equal(saved[0]?.googleEventId, "evt_confirmed");
    assert.equal(saved[0]?.confirmationSentAt, null);
    setup.restore();
  });

  it("does not send a confirmation when creating the calendar event fails", async () => {
    const setup = await readyWorkspace("harbor-mail-fail@example.com");
    const google = fetchFor(500);
    await assert.rejects(() => book(setup, google.fetchImpl));
    assert.equal(google.calls.filter((call) => call.url.includes("/messages/send")).length, 0);
    assert.equal((await setup.store.listCalendarAppointments(setup.workspace.id)).length, 0);
    setup.restore();
  });
});

describe("Calendar access token refresh", () => {
  const now = new Date("2026-10-08T15:00:00.000Z");

  async function connectedWorkspace(accessTokenExpiresAt: Date) {
    const previous = {
      AUTH_SECRET: process.env.AUTH_SECRET,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      APP_URL: process.env.APP_URL,
    };
    process.env.AUTH_SECRET = previous.AUTH_SECRET && previous.AUTH_SECRET.length >= 16 ? previous.AUTH_SECRET : "test-auth-secret-value";
    process.env.GOOGLE_CLIENT_ID = "calendar-client.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "calendar-client-secret";
    process.env.APP_URL = "https://www.mybizpilotai.com";
    const { store, workspace } = await paidWorkspace("Harbor Refresh", `harbor-refresh-${accessTokenExpiresAt.getTime()}@example.com`);
    const refreshCipher = encryptSecret("refresh-harbor");
    const gmailRefresh = encryptSecret("refresh-gmail");
    const gmailAccess = encryptSecret("access-gmail");
    await store.upsertGoogleCalendarConnection({
      workspaceId: workspace.id,
      googleEmail: "harbor@gmail.com",
      encryptedRefreshToken: refreshCipher,
      encryptedAccessToken: encryptSecret("access-stale"),
      accessTokenExpiresAt,
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "harbor-calendar",
      calendarSummary: "Harbor",
    });
    await store.upsertGmailConnection({
      workspaceId: workspace.id,
      googleEmail: "harbor@gmail.com",
      encryptedRefreshToken: gmailRefresh,
      encryptedAccessToken: gmailAccess,
      accessTokenExpiresAt: new Date("2026-10-10T18:00:00.000Z"),
      scopes: "openid https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
      status: "connected",
    });
    const hours = settings();
    await store.upsertCalendarBookingSettings({
      workspaceId: workspace.id,
      durationMinutes: hours.durationMinutes,
      availableDays: hours.availableDays,
      startMinutes: hours.startMinutes,
      endMinutes: hours.endMinutes,
      timezone: hours.timezone,
      minNoticeMinutes: hours.minNoticeMinutes,
      bufferMinutes: hours.bufferMinutes,
    });
    return {
      store,
      workspace,
      refreshCipher,
      gmailRefresh,
      gmailAccess,
      restore: () => {
        process.env.AUTH_SECRET = previous.AUTH_SECRET;
        process.env.GOOGLE_CLIENT_ID = previous.GOOGLE_CLIENT_ID;
        process.env.GOOGLE_CLIENT_SECRET = previous.GOOGLE_CLIENT_SECRET;
        process.env.APP_URL = previous.APP_URL;
      },
    };
  }

  function fetchFor(input: { onFreeBusy: (call: number) => Response; onToken?: () => Response; onEvent?: () => Response }) {
    const calls: { url: string; authorization: string }[] = [];
    let busyCalls = 0;
    const fetchImpl: typeof fetch = async (url, init) => {
      const headers = new Headers(init?.headers);
      calls.push({ url: String(url), authorization: headers.get("authorization") ?? "" });
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return input.onToken ? input.onToken() : new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      if (String(url).includes("freeBusy")) {
        busyCalls += 1;
        return input.onFreeBusy(busyCalls);
      }
      if (String(url).includes("/events")) {
        return input.onEvent ? input.onEvent() : new Response(JSON.stringify({ id: "evt_refreshed" }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    };
    return { fetchImpl, calls };
  }

  function renewedToken() {
    return new Response(JSON.stringify({ access_token: "access-renewed", expires_in: 3600, scope: CALENDAR_SCOPES.join(" ") }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("refreshes an expired access token, keeps the refresh token, and leaves Gmail alone", async () => {
    const setup = await connectedWorkspace(new Date(Date.now() - 5 * 60 * 1000));
    const google = fetchFor({
      onToken: renewedToken,
      onFreeBusy: () =>
        new Response(JSON.stringify({ calendars: { "harbor-calendar": { busy: [] } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    const turn = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-refresh",
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(turn?.answer ?? "", /Choose one/);
    assert.doesNotMatch(turn?.answer ?? "", /revoked or expired/);
    assert.match(google.calls.find((call) => call.url.includes("freeBusy"))?.authorization ?? "", /Bearer access-renewed/);
    const saved = await setup.store.getGoogleCalendarConnection(setup.workspace.id);
    assert.equal(saved?.status, "connected");
    assert.equal(saved?.encryptedRefreshToken, setup.refreshCipher);
    assert.equal(decryptSecret(saved?.encryptedAccessToken ?? ""), "access-renewed");
    assert.ok((saved?.accessTokenExpiresAt.getTime() ?? 0) > Date.now());
    const gmail = await setup.store.getGmailConnection(setup.workspace.id);
    assert.equal(gmail?.encryptedRefreshToken, setup.gmailRefresh);
    assert.equal(gmail?.encryptedAccessToken, setup.gmailAccess);
    assert.equal(gmail?.status, "connected");
    setup.restore();
  });

  it("refreshes once when Google rejects an unexpired access token, then reads availability", async () => {
    const setup = await connectedWorkspace(new Date("2026-10-10T18:00:00.000Z"));
    const google = fetchFor({
      onToken: renewedToken,
      onFreeBusy: (call) =>
        call === 1
          ? new Response(JSON.stringify({ error: { code: 401, status: "UNAUTHENTICATED", errors: [{ reason: "authError" }] } }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            })
          : new Response(JSON.stringify({ calendars: { "harbor-calendar": { busy: [] } } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
    });
    const turn = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-stale",
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(turn?.answer ?? "", /Choose one/);
    assert.doesNotMatch(turn?.answer ?? "", /revoked or expired/);
    assert.equal(google.calls.filter((call) => call.url.includes("freeBusy")).length, 2);
    assert.equal(google.calls.filter((call) => call.url.includes("/token")).length, 1);
    assert.equal((await setup.store.getGoogleCalendarConnection(setup.workspace.id))?.status, "connected");
    assert.equal((await setup.store.getGoogleCalendarConnection(setup.workspace.id))?.encryptedRefreshToken, setup.refreshCipher);
    assert.equal((await setup.store.getGmailConnection(setup.workspace.id))?.encryptedRefreshToken, setup.gmailRefresh);
    assert.equal((await setup.store.getGmailConnection(setup.workspace.id))?.status, "connected");
    setup.restore();
  });

  it("does not report Calendar as revoked after a successful booking when the next call can refresh", async () => {
    const setup = await connectedWorkspace(new Date("2026-10-10T18:00:00.000Z"));
    const google = fetchFor({
      onToken: renewedToken,
      onFreeBusy: (call) =>
        call === 4
          ? new Response(JSON.stringify({ error: { code: 401, message: "Invalid Credentials" } }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            })
          : new Response(JSON.stringify({ calendars: { "harbor-calendar": { busy: [] } } }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }),
    });
    const asked = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-after-book",
      question: "I'd like to book an appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    const slot = asked?.sources[0];
    assert.ok(slot?.slotStart);
    const held = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-after-book",
      conversationId: asked?.conversationId,
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(held?.answer ?? "", /name and email/i);
    const booked = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-after-book",
      conversationId: asked?.conversationId,
      question: "Ada Lovelace ada@example.com for a sizing",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(booked?.answer ?? "", /You're booked/);
    assert.doesNotMatch(booked?.answer ?? "", /revoked or expired/);
    assert.equal((await setup.store.listCalendarAppointments(setup.workspace.id)).length, 1);
    const again = await handleCalendarWidgetTurn({
      store: setup.store,
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-after-book",
      conversationId: asked?.conversationId,
      question: "I'd like to book another appointment tomorrow. What times are available?",
      now,
      fetchImpl: google.fetchImpl,
    });
    assert.match(again?.answer ?? "", /Choose one|open times/i);
    assert.doesNotMatch(again?.answer ?? "", /revoked or expired/);
    assert.doesNotMatch(again?.answer ?? "", /ada@example.com/);
    assert.equal((await setup.store.getGoogleCalendarConnection(setup.workspace.id))?.status, "connected");
    assert.equal((await setup.store.getGmailConnection(setup.workspace.id))?.encryptedRefreshToken, setup.gmailRefresh);
    assert.equal((await setup.store.getGmailConnection(setup.workspace.id))?.status, "connected");
    setup.restore();
  });

  it("marks only the calendar connection for reconnect when the refresh token is revoked", async () => {
    const setup = await connectedWorkspace(new Date(Date.now() - 5 * 60 * 1000));
    const logs: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(" "));
    };
    const google = fetchFor({
      onToken: () =>
        new Response(JSON.stringify({ error: "invalid_grant", error_description: "Token has been expired or revoked." }), {
          status: 400,
        }),
      onFreeBusy: () => new Response("{}", { status: 500 }),
    });
    let turn;
    try {
      turn = await handleCalendarWidgetTurn({
        store: setup.store,
        widgetKey: setup.workspace.widgetKey,
        visitorKey: "visitor-revoked",
        question: "I'd like to book an appointment tomorrow. What times are available?",
        now,
        fetchImpl: google.fetchImpl,
      });
    } finally {
      console.error = original;
    }
    assert.equal(turn?.answer, DISCONNECTED_CALENDAR_REPLY);
    assert.equal(google.calls.filter((call) => call.url.includes("freeBusy")).length, 0);
    const calendar = await setup.store.getGoogleCalendarConnection(setup.workspace.id);
    assert.equal(calendar?.status, "needs_reconnect");
    assert.equal(calendar?.encryptedRefreshToken, setup.refreshCipher);
    const gmail = await setup.store.getGmailConnection(setup.workspace.id);
    assert.equal(gmail?.status, "connected");
    assert.equal(gmail?.encryptedRefreshToken, setup.gmailRefresh);
    assert.equal(gmail?.encryptedAccessToken, setup.gmailAccess);
    assert.ok(logs.some((line) => line.includes("invalid_grant") && line.includes("400")));
    assert.equal(logs.some((line) => /refresh-harbor|access-stale|calendar-client-secret|access-gmail/.test(line)), false);
    setup.restore();
  });

  it("does not treat a disabled Calendar API as a revoked refresh token", async () => {
    const setup = await connectedWorkspace(new Date("2026-10-10T18:00:00.000Z"));
    const logs: string[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
      logs.push(args.map((item) => String(item)).join(" "));
    };
    const google = fetchFor({
      onFreeBusy: () =>
        new Response(
          JSON.stringify({
            error: {
              code: 403,
              status: "PERMISSION_DENIED",
              errors: [{ reason: "accessNotConfigured" }],
            },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
    });
    try {
      await assert.rejects(
        () =>
          handleCalendarWidgetTurn({
            store: setup.store,
            widgetKey: setup.workspace.widgetKey,
            visitorKey: "visitor-api",
            question: "I'd like to book an appointment tomorrow. What times are available?",
            now,
            fetchImpl: google.fetchImpl,
          }),
        (error: unknown) => {
          assert.ok(error instanceof BillingError);
          assert.equal(error.code, "misconfigured");
          assert.match(error.message, /Google Calendar API is not enabled/);
          assert.doesNotMatch(error.message, /revoked or expired/);
          return true;
        },
      );
    } finally {
      console.error = original;
    }
    assert.equal(google.calls.filter((call) => call.url.includes("/token")).length, 0);
    assert.equal((await setup.store.getGoogleCalendarConnection(setup.workspace.id))?.status, "connected");
    assert.equal((await setup.store.getGmailConnection(setup.workspace.id))?.encryptedRefreshToken, setup.gmailRefresh);
    assert.ok(logs.some((line) => line.includes("accessNotConfigured")));
    assert.equal(logs.some((line) => /access-stale|refresh-harbor|calendar-client-secret/.test(line)), false);
    setup.restore();
  });

  it("stores a Gmail reconnect on the Gmail row only", async () => {
    const setup = await connectedWorkspace(new Date("2026-10-10T18:00:00.000Z"));
    const calendarBefore = await setup.store.getGoogleCalendarConnection(setup.workspace.id);
    await setup.store.upsertGmailConnection({
      workspaceId: setup.workspace.id,
      googleEmail: "harbor@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-gmail-reconnected"),
      encryptedAccessToken: encryptSecret("access-gmail-reconnected"),
      accessTokenExpiresAt: new Date("2026-10-11T18:00:00.000Z"),
      scopes: "openid https://www.googleapis.com/auth/gmail.send",
      status: "connected",
    });
    const calendarAfter = await setup.store.getGoogleCalendarConnection(setup.workspace.id);
    assert.equal(calendarAfter?.encryptedRefreshToken, calendarBefore?.encryptedRefreshToken);
    assert.equal(calendarAfter?.encryptedAccessToken, calendarBefore?.encryptedAccessToken);
    assert.equal(calendarAfter?.status, "connected");
    const gmail = await setup.store.getGmailConnection(setup.workspace.id);
    assert.equal(gmail?.status, "connected");
    assert.notEqual(gmail?.encryptedRefreshToken, setup.gmailRefresh);
    await setup.store.upsertGoogleCalendarConnection({
      workspaceId: setup.workspace.id,
      googleEmail: "harbor@gmail.com",
      encryptedRefreshToken: encryptSecret("refresh-calendar-reconnected"),
      encryptedAccessToken: encryptSecret("access-calendar-reconnected"),
      accessTokenExpiresAt: new Date("2026-10-11T18:00:00.000Z"),
      scopes: CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: "harbor-calendar",
      calendarSummary: "Harbor",
    });
    const gmailAfter = await setup.store.getGmailConnection(setup.workspace.id);
    assert.equal(gmailAfter?.encryptedRefreshToken, gmail?.encryptedRefreshToken);
    assert.equal(gmailAfter?.encryptedAccessToken, gmail?.encryptedAccessToken);
    assert.equal(gmailAfter?.status, "connected");
    const { readFileSync } = await import("node:fs");
    const gmailCallback = readFileSync("app/api/app/gmail/callback/route.ts", "utf8");
    const calendarCallback = readFileSync("app/api/app/calendar/callback/route.ts", "utf8");
    assert.doesNotMatch(gmailCallback, /upsertGoogleCalendarConnection|revokeGoogleToken/);
    assert.doesNotMatch(calendarCallback, /upsertGmailConnection|revokeGoogleToken/);
    setup.restore();
  });
});
