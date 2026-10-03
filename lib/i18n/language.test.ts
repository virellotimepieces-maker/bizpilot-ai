import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BillingService } from "@/lib/billing/service";
import { MemoryBillingStore } from "@/lib/billing/memory-store";
import { applyStripeEvent } from "@/lib/billing/stripe-events";
import type { StripeLikeEvent } from "@/lib/billing/types";
import { handleCalendarWidgetTurn } from "@/lib/calendar/booking";
import { CALENDAR_SCOPES } from "@/lib/calendar/config";
import type { CalendarBookingSettingsRecord } from "@/lib/calendar/types";
import { encryptSecret } from "@/lib/gmail/token-crypto";
import { asksForLiveAppointment, resolveConversationLanguage } from "./conversation-language";
import { localizeAssistantText, type TranslateFn } from "./localize";

const NOW = new Date("2026-10-08T15:00:00.000Z");
const FIRST_SLOT = "2026-10-09T13:00:00.000Z";
const TAGALOG = "Gusto ko mag-book ng appointment bukas. Anong oras ang available?";
const SPANISH = "Hola, quiero una cita mañana. ¿Qué horarios tienes disponibles?";
const ENGLISH = "I'd like to book an appointment tomorrow. What times are available?";

function translate(text: string, language: string) {
  return Promise.resolve(`[[${language}]] ${text}`);
}

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function settings(): CalendarBookingSettingsRecord {
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
  };
}

async function readyWorkspace(email: string) {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = previous && previous.length >= 16 ? previous : "test-auth-secret-value";
  const store = new MemoryBillingStore();
  const user = await store.createUser({ email, passwordHash: "hash", name: "Harbor" });
  const workspace = await store.createWorkspace({ ownerUserId: user.id, name: "Harbor" });
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
    service: new BillingService(store),
    restore: () => {
      process.env.AUTH_SECRET = previous;
    },
  };
}

function fetchFor() {
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
      return new Response(JSON.stringify({ id: `evt_${calls.length}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (String(url).includes("/messages/send")) {
      return new Response(JSON.stringify({ id: "msg_confirmed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 404 });
  };
  return { fetchImpl, calls };
}

async function ask(
  setup: Awaited<ReturnType<typeof readyWorkspace>>,
  fetchImpl: typeof fetch,
  input: { visitorKey: string; question: string; conversationId?: string; slotStart?: string; translate?: TranslateFn },
) {
  return handleCalendarWidgetTurn({
    store: setup.store,
    widgetKey: setup.workspace.widgetKey,
    visitorKey: input.visitorKey,
    conversationId: input.conversationId,
    question: input.question,
    slotStart: input.slotStart,
    now: NOW,
    fetchImpl,
    translate: input.translate,
  });
}

describe("conversation language", () => {
  it("detects a language and keeps it for names, emails, and short replies", () => {
    assert.equal(resolveConversationLanguage("", TAGALOG), "tl");
    assert.equal(resolveConversationLanguage("", SPANISH), "es");
    assert.equal(resolveConversationLanguage("", ENGLISH), "en");
    assert.equal(resolveConversationLanguage("", "Hola"), "es");
    assert.equal(resolveConversationLanguage("", "予約したいです"), "ja");
    assert.equal(resolveConversationLanguage("tl", "Elmer Hidalgo ilumin"), "tl");
    assert.equal(resolveConversationLanguage("tl", "customer@example.com"), "tl");
    assert.equal(resolveConversationLanguage("tl", "oo"), "tl");
    assert.equal(resolveConversationLanguage("tl", "Fri, Oct 9, 9:00 AM"), "tl");
    assert.equal(
      resolveConversationLanguage("tl", "What times are available tomorrow?"),
      "en",
    );
    assert.equal(asksForLiveAppointment(SPANISH), true);
    assert.equal(asksForLiveAppointment("What are your hours?"), false);
  });

  it("leaves English unchanged and keeps factual tokens in a translation", async () => {
    let calls = 0;
    const english = await localizeAssistantText("Choose one.", "en", async (text) => {
      calls += 1;
      return `[[es]] ${text}`;
    });
    assert.equal(english, "Choose one.");
    assert.equal(calls, 0);
    const dropped = await localizeAssistantText(
      "A confirmation email was sent to ada@example.com.",
      "tl",
      async () => "Walang email dito",
    );
    assert.equal(dropped, "A confirmation email was sent to ada@example.com.");
    const kept = await localizeAssistantText(
      "You're booked for Fri, Oct 9, 9:00 AM. A confirmation email was sent to ada@example.com.",
      "es",
      translate,
    );
    assert.match(kept, /^\[\[es\]\]/);
    assert.match(kept, /Fri, Oct 9, 9:00 AM/);
    assert.match(kept, /ada@example.com/);
  });
});

describe("multilingual appointment booking", () => {
  it("books in English without translating the deterministic replies", async () => {
    const setup = await readyWorkspace("lang-en@example.com");
    const google = fetchFor();
    let translations = 0;
    const counting: TranslateFn = async (text, language) => {
      translations += 1;
      return translate(text, language);
    };
    const asked = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-en",
      question: ENGLISH,
      translate: counting,
    });
    assert.match(asked?.answer ?? "", /Choose one/);
    assert.doesNotMatch(asked?.answer ?? "", /\[\[/);
    assert.equal(asked?.sources[0]?.slotStart, FIRST_SLOT);
    const slot = asked?.sources[0];
    const named = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-en",
      conversationId: asked?.conversationId,
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      translate: counting,
    });
    assert.match(named?.answer ?? "", /Please send your name and email/);
    const booked = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-en",
      conversationId: asked?.conversationId,
      question: "Ada Lovelace ada@example.com for a sizing",
      translate: counting,
    });
    assert.match(booked?.answer ?? "", /You're booked for/);
    assert.match(booked?.answer ?? "", /ada@example.com/);
    assert.equal(translations, 0);
    assert.equal((await setup.store.listCalendarAppointments(setup.workspace.id)).length, 1);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, 1);
    const send = google.calls.find((call) => call.url.includes("/messages/send"));
    const rfc822 = Buffer.from((send?.body as { raw?: string }).raw ?? "", "base64url").toString("utf8");
    assert.match(rfc822, /Subject: Appointment confirmed - Harbor/);
    assert.match(rfc822, /Hi Ada Lovelace,/);
    assert.match(rfc822, /Timezone: America\/New_York/);
    assert.doesNotMatch(rfc822, /\[\[/);
    setup.restore();
  });

  it("books in Tagalog, keeps that language for a name and an email, and confirms in Tagalog", async () => {
    const setup = await readyWorkspace("lang-tl@example.com");
    const google = fetchFor();
    const asked = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-tl",
      question: TAGALOG,
      translate,
    });
    assert.match(asked?.answer ?? "", /^\[\[tl\]\]/);
    assert.match(asked?.answer ?? "", /Choose one/);
    assert.match(asked?.sources[0]?.slotStart ?? "", /^\d{4}-\d{2}-\d{2}T/);
    assert.match(asked?.sources[0]?.title ?? "", /\d{1,2}:\d{2}/);
    const slot = asked?.sources[0];
    const selected = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-tl",
      conversationId: asked?.conversationId,
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      translate,
    });
    assert.match(selected?.answer ?? "", /^\[\[tl\]\]/);
    assert.match(selected?.answer ?? "", /name and email/);
    assert.match(selected?.answer ?? "", new RegExp(slot?.title ?? "missing-slot"));
    const named = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-tl",
      conversationId: asked?.conversationId,
      question: "Elmer Hidalgo ilumin",
      translate,
    });
    assert.match(named?.answer ?? "", /^\[\[tl\]\]/);
    assert.match(named?.answer ?? "", /email address/);
    assert.equal(
      (await setup.store.getConversation(asked?.conversationId ?? "", setup.workspace.id))?.detectedLanguage,
      "tl",
    );
    assert.equal((await setup.store.listCalendarAppointments(setup.workspace.id)).length, 0);
    const emailed = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-tl",
      conversationId: asked?.conversationId,
      question: "customer@example.com",
      translate,
    });
    assert.match(emailed?.answer ?? "", /^\[\[tl\]\]/);
    assert.match(emailed?.answer ?? "", /You're booked for/);
    assert.match(emailed?.answer ?? "", /customer@example.com/);
    assert.match(emailed?.answer ?? "", new RegExp(slot?.title ?? "missing-slot"));
    const conversation = await setup.store.getConversation(asked?.conversationId ?? "", setup.workspace.id);
    assert.equal(conversation?.detectedLanguage, "tl");
    const appointments = await setup.store.listCalendarAppointments(setup.workspace.id);
    assert.equal(appointments.length, 1);
    assert.equal(appointments[0]?.customerName, "Elmer Hidalgo ilumin");
    assert.equal(appointments[0]?.email, "customer@example.com");
    assert.equal(appointments[0]?.startsAt.toISOString(), slot?.slotStart);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, 1);
    const leads = await setup.store.listLeads(setup.workspace.id);
    assert.equal(leads.length, 1);
    assert.equal(leads[0]?.name, "Elmer Hidalgo ilumin");
    assert.equal(leads[0]?.email, "customer@example.com");
    assert.equal(leads[0]?.workspaceId, setup.workspace.id);
    const send = google.calls.find((call) => call.url.includes("/messages/send"));
    assert.match(send?.authorization ?? "", /Bearer access-gmail/);
    const rfc822 = Buffer.from((send?.body as { raw?: string }).raw ?? "", "base64url").toString("utf8");
    assert.match(rfc822, /From: harbor@gmail.com/);
    assert.match(rfc822, /To: customer@example.com/);
    assert.match(rfc822, /Subject: Appointment confirmed - Harbor/);
    assert.match(rfc822, /\[\[tl\]\]/);
    assert.match(rfc822, /Hi Elmer Hidalgo ilumin,/);
    assert.match(rfc822, /Harbor/);
    assert.match(rfc822, /Date: Thursday, October 8, 2026/);
    assert.match(rfc822, /Time: 11:00 AM/);
    assert.match(rfc822, /Timezone: America\/New_York/);
    assert.match(rfc822, /Duration: 30 minutes/);
    const retry = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-tl",
      conversationId: asked?.conversationId,
      question: "Elmer Hidalgo ilumin",
      translate,
    });
    assert.doesNotMatch(retry?.answer ?? "", /You're booked/);
    assert.equal((await setup.store.listCalendarAppointments(setup.workspace.id)).length, 1);
    assert.equal(google.calls.filter((call) => call.url.includes("/events")).length, 1);
    assert.equal(google.calls.filter((call) => call.url.includes("/messages/send")).length, 1);
    setup.restore();
  });

  it("stays in Tagalog when the only message is an email", async () => {
    const setup = await readyWorkspace("lang-tl-email@example.com");
    const google = fetchFor();
    const asked = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-tl-email",
      question: TAGALOG,
      translate,
    });
    const slot = asked?.sources[0];
    await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-tl-email",
      conversationId: asked?.conversationId,
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      translate,
    });
    const emailed = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-tl-email",
      conversationId: asked?.conversationId,
      question: "customer@example.com",
      translate,
    });
    assert.match(emailed?.answer ?? "", /^\[\[tl\]\]/);
    assert.match(emailed?.answer ?? "", /Please send the name/);
    assert.match(emailed?.answer ?? "", new RegExp(slot?.title ?? "missing-slot"));
    assert.equal(
      (await setup.store.getConversation(asked?.conversationId ?? "", setup.workspace.id))?.detectedLanguage,
      "tl",
    );
    assert.equal((await setup.store.listCalendarAppointments(setup.workspace.id)).length, 0);
    const leads = await setup.store.listLeads(setup.workspace.id);
    assert.equal(leads.length, 1);
    assert.equal(leads[0]?.email, "customer@example.com");
    setup.restore();
  });

  it("books in Spanish and keeps the slot time", async () => {
    const setup = await readyWorkspace("lang-es@example.com");
    const google = fetchFor();
    const asked = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-es",
      question: SPANISH,
      translate,
    });
    assert.match(asked?.answer ?? "", /^\[\[es\]\]/);
    assert.match(asked?.answer ?? "", /Choose one/);
    assert.match(asked?.sources[0]?.slotStart ?? "", /^\d{4}-\d{2}-\d{2}T/);
    const slot = asked?.sources[0];
    await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-es",
      conversationId: asked?.conversationId,
      question: slot?.title ?? "",
      slotStart: slot?.slotStart,
      translate,
    });
    const booked = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-es",
      conversationId: asked?.conversationId,
      question: "Ada Lovelace ada@example.com for a sizing",
      translate,
    });
    assert.match(booked?.answer ?? "", /^\[\[es\]\]/);
    assert.match(booked?.answer ?? "", /ada@example.com/);
    assert.match(booked?.answer ?? "", new RegExp(slot?.title ?? "missing-slot"));
    assert.equal(
      (await setup.store.getConversation(asked?.conversationId ?? "", setup.workspace.id))?.detectedLanguage,
      "es",
    );
    const appointments = await setup.store.listCalendarAppointments(setup.workspace.id);
    assert.equal(appointments.length, 1);
    assert.equal(appointments[0]?.email, "ada@example.com");
    assert.equal(appointments[0]?.startsAt.toISOString(), slot?.slotStart);
    const send = google.calls.find((call) => call.url.includes("/messages/send"));
    const rfc822 = Buffer.from((send?.body as { raw?: string }).raw ?? "", "base64url").toString("utf8");
    assert.match(rfc822, /\[\[es\]\]/);
    assert.match(rfc822, /Hi Ada Lovelace,/);
    assert.match(rfc822, /Reason: sizing/);
    assert.match(rfc822, /From: harbor@gmail.com/);
    assert.match(rfc822, /To: ada@example.com/);
    setup.restore();
  });

  it("switches later replies to English when the visitor changes language", async () => {
    const setup = await readyWorkspace("lang-switch@example.com");
    const google = fetchFor();
    const asked = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-switch",
      question: TAGALOG,
      translate,
    });
    assert.match(asked?.answer ?? "", /^\[\[tl\]\]/);
    let translations = 0;
    const counting: TranslateFn = async (text, language) => {
      translations += 1;
      return translate(text, language);
    };
    const switched = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-switch",
      conversationId: asked?.conversationId,
      question: "What times are available tomorrow?",
      translate: counting,
    });
    assert.match(switched?.answer ?? "", /Choose one/);
    assert.doesNotMatch(switched?.answer ?? "", /\[\[/);
    assert.equal(translations, 0);
    assert.equal(switched?.sources[0]?.slotStart, FIRST_SLOT);
    assert.equal(
      (await setup.store.getConversation(asked?.conversationId ?? "", setup.workspace.id))?.detectedLanguage,
      "en",
    );
    setup.restore();
  });

  it("pauses AI during human takeover and answers again after Resume AI", async () => {
    const setup = await readyWorkspace("lang-human@example.com");
    const google = fetchFor();
    const asked = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-human",
      question: TAGALOG,
      translate,
    });
    assert.equal(
      (await setup.store.getConversation(asked?.conversationId ?? "", setup.workspace.id))?.detectedLanguage,
      "tl",
    );
    await setup.service.handoffToHuman(setup.workspace.widgetKey, asked?.conversationId ?? "", NOW);
    let generated = 0;
    const pausedCalendar = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-human",
      conversationId: asked?.conversationId,
      question: "Gusto ko pa rin ng appointment bukas.",
      translate,
    });
    assert.equal(pausedCalendar, null);
    const paused = await setup.service.generateCountedAiReply({
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-human",
      conversationId: asked?.conversationId,
      question: "Sige po",
      now: NOW,
      translate,
      generate: async () => {
        generated += 1;
        return "Should not run";
      },
    });
    assert.equal(paused.waitingOnHuman, true);
    assert.equal(generated, 0);
    assert.equal(paused.usage, null);
    assert.match(paused.answer, /^\[\[tl\]\]/);
    assert.match(paused.answer, /AI replies are paused/);
    assert.equal((await setup.store.listCalendarAppointments(setup.workspace.id)).length, 0);
    await setup.service.resumeAi(setup.workspace.id, asked?.conversationId ?? "");
    const resumed = await setup.service.generateCountedAiReply({
      widgetKey: setup.workspace.widgetKey,
      visitorKey: "visitor-human",
      conversationId: asked?.conversationId,
      question: "Do you provide website hosting?",
      now: NOW,
      translate,
      generate: async (_knowledge, _question, _pages, _products, language) => {
        generated += 1;
        assert.equal(language, "tl");
        return "Open tomorrow.";
      },
    });
    assert.equal(resumed.waitingOnHuman, false);
    assert.equal(generated, 1);
    assert.equal(resumed.answer, "Open tomorrow.");
    const resumedCalendar = await ask(setup, google.fetchImpl, {
      visitorKey: "visitor-human",
      conversationId: asked?.conversationId,
      question: TAGALOG,
      translate,
    });
    assert.match(resumedCalendar?.answer ?? "", /^\[\[tl\]\]/);
    assert.match(resumedCalendar?.sources[0]?.slotStart ?? "", /^\d{4}-\d{2}-\d{2}T/);
    setup.restore();
  });
});
