import { BillingService } from "@/lib/billing/service";
import type { BillingStore } from "@/lib/billing/store";
import { BillingError } from "@/lib/billing/types";
import type { WebsiteReplySource } from "@/lib/website/types";
import { extractRequestedService, isAppointmentRequestQuestion } from "@/lib/v2/appointments";
import { calendarAccessToken, refreshStoredCalendarAccess } from "./access";
import { sendBookingConfirmation } from "./confirmation";
import { buildAvailableSlots, requestedWindow } from "./availability";
import { insertCalendarEvent, queryCalendarFreeBusy, type BusyInterval } from "./google";
import { defaultCalendarSettings } from "./settings";
import type { CalendarBookingSessionRecord, CalendarBookingSettingsRecord, CalendarSlot } from "./types";

const AVAILABILITY_RE = /\b(available|availability|opening|openings|open slot|free slot)\b/i;
const WHEN_WORD_RE = /\b(today|tomorrow|tonight|morning|afternoon|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i;
const TIMES_RE = /\b(what|which|any)\s+times?\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const NOT_A_NAME_RE =
  /^(?:mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|yes|yeah|yep|ok|okay|confirm|confirmed)$/i;

export const DISCONNECTED_CALENDAR_REPLY =
  "I can't check live availability or book a time because this business hasn't connected a calendar. I can save an appointment request for the team. Please share your name, email, and what you'd like to book.";

export function isCalendarCustomerRequest(question: string) {
  const text = question.trim();
  if (!text || text.startsWith("slot:")) return false;
  if (isAppointmentRequestQuestion(text)) return true;
  if (TIMES_RE.test(text) && (AVAILABILITY_RE.test(text) || WHEN_WORD_RE.test(text))) return true;
  return AVAILABILITY_RE.test(text) && WHEN_WORD_RE.test(text);
}

export function readBookingContact(
  text: string,
  current: { customerName: string; email: string; service: string },
  options?: { slotSelection?: boolean },
) {
  const foundEmail = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? "";
  const email = foundEmail || current.email;
  let customerName = current.customerName;
  const named = options?.slotSelection
    ? null
    : text.match(/\b(?:my name is|i am|i'm|this is)\s+([A-Za-z][A-Za-z .'-]{1,80})/i);
  if (named?.[1]) {
    customerName = named[1].replace(/\b(and|my|email|for)\b.*$/i, "").trim();
  } else if (!options?.slotSelection) {
    const simple = text.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\b/);
    const candidate = simple?.[1] ?? "";
    const first = candidate.split(/\s+/)[0] ?? "";
    const acceptable = candidate && !candidate.includes("@") && !NOT_A_NAME_RE.test(first) && nameStandsAlone(text, candidate);
    if (acceptable && (!customerName || EMAIL_RE.test(text))) customerName = candidate;
  }
  const extracted = extractRequestedService(text) || readLooseBookingReason(text);
  const service = current.service || extracted;
  return {
    customerName: customerName.replace(/\s+/g, " ").trim().slice(0, 120),
    email: email.trim().slice(0, 160),
    service: service.replace(/\s+/g, " ").trim().slice(0, 160),
  };
}

function nameStandsAlone(text: string, candidate: string) {
  const at = text.indexOf(candidate);
  const rest = (at >= 0 ? text.slice(at + candidate.length) : "").trim().replace(/^[,.-]+/, "").trim();
  if (!rest) return true;
  if (EMAIL_RE.test(rest)) return true;
  return /^for\b/i.test(rest);
}

function readLooseBookingReason(text: string) {
  const match = text.match(/\bfor\s+(?:an?\s+)?([A-Za-z][\w .'-]{1,80})/i);
  const value = match?.[1]?.replace(/\s+(?:on|at|and|,).*$/i, "").trim() ?? "";
  if (!value || /^(?:me|you|it|that|this|today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(value)) {
    return "";
  }
  return value;
}

function missingContactPrompt(name: string, email: string, label: string) {
  const when = label ? ` for ${label}` : "";
  if (!name && !email) {
    return `That time${when} is open. Please send your name and email to book it. You can add a reason for the appointment if you want.`;
  }
  if (!name) return `Please send the name to put on the appointment${when}.`;
  return `Please send the email address for the appointment${when}.`;
}

function slotSources(slots: CalendarSlot[]): WebsiteReplySource[] {
  return slots.map((slot) => ({
    title: slot.label,
    url: `slot:${slot.start}`,
    kind: "other" as const,
    slotStart: slot.start,
    slotEnd: slot.end,
  }));
}

function chosenSlot(question: string, slotStart: string | undefined, offered: CalendarSlot[]) {
  if (slotStart) {
    const match = offered.find((slot) => slot.start === slotStart);
    if (match) return match;
  }
  const trimmed = question.trim();
  return offered.find((slot) => slot.label === trimmed || slot.start === trimmed.replace(/^slot:/, "")) ?? null;
}

async function rememberSession(
  store: BillingStore,
  session: CalendarBookingSessionRecord,
  patch: Partial<Pick<CalendarBookingSessionRecord, "customerName" | "email" | "service" | "offeredSlots" | "status">>,
) {
  return store.upsertCalendarBookingSession({
    workspaceId: session.workspaceId,
    conversationId: session.conversationId,
    customerName: patch.customerName ?? session.customerName,
    email: patch.email ?? session.email,
    service: patch.service ?? session.service,
    offeredSlots: patch.offeredSlots ?? session.offeredSlots,
    status: patch.status ?? session.status,
  });
}

export type CalendarTurnResult = {
  conversationId: string;
  answer: string;
  sources: WebsiteReplySource[];
  waitingOnHuman: false;
};

export async function handleCalendarWidgetTurn(input: {
  store: BillingStore;
  widgetKey: string;
  visitorKey: string;
  conversationId?: string;
  question: string;
  slotStart?: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<CalendarTurnResult | null> {
  const now = input.now ?? new Date();
  const fetchImpl = input.fetchImpl ?? fetch;
  const workspace = await input.store.getWorkspaceByWidgetKey(input.widgetKey);
  if (!workspace) return null;
  const business = workspace;
  const explicitSlot = Boolean(input.slotStart?.trim());
  const intent = isCalendarCustomerRequest(input.question) || explicitSlot;
  const existing = input.conversationId
    ? await input.store.getConversationForVisitor(business.id, input.visitorKey, input.conversationId)
    : null;
  if (existing && existing.workspaceId !== business.id) return null;
  const session = existing ? await input.store.getCalendarBookingSession(business.id, existing.id) : null;
  const inFlow = Boolean(session && session.status !== "booked");
  if (!intent && !inFlow) return null;
  if (existing?.waitingOnHuman) return null;

  await new BillingService(input.store).assertPaidWidgetWorkspace(input.widgetKey, now);
  const conversation =
    existing ??
    (await input.store.createConversation({
      workspaceId: business.id,
      visitorKey: input.visitorKey,
    }));
  const connection = await input.store.getGoogleCalendarConnection(business.id);
  const connected = connection?.status === "connected" && connection.workspaceId === business.id;

  async function reply(answer: string, sources: WebsiteReplySource[] = []) {
    await input.store.addMessage({
      workspaceId: business.id,
      conversationId: conversation.id,
      role: "visitor",
      content: input.question,
      usageCounted: false,
    });
    await input.store.addMessage({
      workspaceId: business.id,
      conversationId: conversation.id,
      role: "assistant",
      content: answer,
      usageCounted: false,
      sources,
    });
    return {
      conversationId: conversation.id,
      answer,
      sources,
      waitingOnHuman: false as const,
    };
  }

  if (!connected) {
    await new BillingService(input.store).noteWidgetAppointmentRequest({
      workspaceId: business.id,
      userId: business.ownerUserId,
      conversationId: conversation.id,
      question: input.question,
    });
    return reply(DISCONNECTED_CALENDAR_REPLY);
  }

  const settings =
    (await input.store.getCalendarBookingSettings(business.id)) ??
    (await input.store.upsertCalendarBookingSettings({
      workspaceId: business.id,
      ...defaultCalendarSettings(),
    }));
  if (settings.workspaceId !== business.id) {
    throw new BillingError("Calendar settings are not available for this workspace.", "forbidden");
  }
  const current =
    session && session.workspaceId === business.id
      ? session
      : await input.store.upsertCalendarBookingSession({
          workspaceId: business.id,
          conversationId: conversation.id,
          customerName: "",
          email: "",
          service: "",
          offeredSlots: [],
          status: "collecting",
        });
  const freshAvailability = isCalendarCustomerRequest(input.question) && !explicitSlot;
  let active = current;
  if (freshAvailability || current.status === "booked") {
    active = await rememberSession(input.store, current, {
      customerName: "",
      email: "",
      service: "",
      offeredSlots: freshAvailability ? [] : current.offeredSlots,
      status: "collecting",
    });
  }
  const collectingThisBooking = active.status === "collecting" && active.offeredSlots.length > 0;
  const slotChoice =
    explicitSlot ||
    active.offeredSlots.some((slot) => slot.label === input.question.trim() || slot.start === input.question.trim().replace(/^slot:/, ""));
  const contact = readBookingContact(
    input.question,
    slotChoice || !collectingThisBooking
      ? { customerName: "", email: "", service: "" }
      : { customerName: active.customerName, email: active.email, service: active.service },
    { slotSelection: slotChoice },
  );
  const pending = collectingThisBooking ? active.offeredSlots[0] : undefined;
  const picked = chosenSlot(input.question, input.slotStart, active.offeredSlots) ?? (freshAvailability ? undefined : pending);
  const emailProvidedInMessage = EMAIL_RE.test(input.question);
  const emailAccepted = emailProvidedInMessage || (!slotChoice && collectingThisBooking && Boolean(active.email));

  if (picked && (!contact.customerName || !contact.email || !emailAccepted)) {
    let accessToken = "";
    try {
      accessToken = await calendarAccessToken(input.store, connection, fetchImpl);
    } catch (error) {
      if (error instanceof BillingError && (error.code === "reconnect" || error.code === "misconfigured")) {
        await new BillingService(input.store).noteWidgetAppointmentRequest({
          workspaceId: business.id,
          userId: business.ownerUserId,
          conversationId: conversation.id,
          question: input.question,
        });
        return reply(DISCONNECTED_CALENDAR_REPLY);
      }
      throw error;
    }
    const stillOpen = await slotStillOpen({
      store: input.store,
      workspaceId: business.id,
      settings,
      accessToken,
      calendarId: connection.calendarId,
      slot: picked,
      fetchImpl,
    });
    if (!stillOpen) {
      const refreshed = await offerSlots({
        store: input.store,
        workspaceId: business.id,
        session: active,
        contact,
        settings,
        accessToken,
        calendarId: connection.calendarId,
        question: input.question,
        now,
        fetchImpl,
        preface: "That time was just taken. Here are the remaining open times.",
      });
      return reply(refreshed.answer, refreshed.sources);
    }
    const rest = active.offeredSlots.filter((slot) => slot.start !== picked.start);
    await rememberSession(input.store, active, {
      customerName: contact.customerName,
      email: emailAccepted ? contact.email : "",
      service: contact.service,
      offeredSlots: [picked, ...rest],
      status: "collecting",
    });
    return reply(missingContactPrompt(contact.customerName, emailAccepted ? contact.email : "", picked.label));
  }

  if (picked && contact.customerName && contact.email && emailAccepted) {
    let accessToken = "";
    try {
      accessToken = await calendarAccessToken(input.store, connection, fetchImpl);
    } catch (error) {
      if (error instanceof BillingError && (error.code === "reconnect" || error.code === "misconfigured")) {
        await new BillingService(input.store).noteWidgetAppointmentRequest({
          workspaceId: business.id,
          userId: business.ownerUserId,
          conversationId: conversation.id,
          question: input.question,
        });
        return reply(DISCONNECTED_CALENDAR_REPLY);
      }
      throw error;
    }
    const start = new Date(picked.start);
    const end = new Date(picked.end);
    const localBusy = (await input.store.listCalendarAppointments(business.id))
      .filter((row) => row.workspaceId === business.id && row.status === "confirmed")
      .map((row) => ({ start: row.startsAt, end: new Date(row.endsAt.getTime() + settings.bufferMinutes * 60 * 1000) }));
    let remoteBusy: BusyInterval[] = [];
    try {
      remoteBusy = await withFreshCalendarToken(input.store, business.id, fetchImpl, accessToken, (token) =>
        queryCalendarFreeBusy(
          {
            accessToken: token,
            calendarId: connection.calendarId,
            timeMin: new Date(start.getTime() - 60 * 1000),
            timeMax: new Date(end.getTime() + settings.bufferMinutes * 60 * 1000 + 60 * 1000),
          },
          fetchImpl,
        ),
      );
    } catch (error) {
      if (error instanceof BillingError && error.code === "reconnect") {
        return reply(DISCONNECTED_CALENDAR_REPLY);
      }
      throw error;
    }
    const occupiedEnd = new Date(end.getTime() + settings.bufferMinutes * 60 * 1000);
    const taken = [...localBusy, ...remoteBusy].some((interval) => start < interval.end && occupiedEnd > interval.start);
    if (taken) {
      const refreshed = await offerSlots({
        store: input.store,
        workspaceId: business.id,
        session: active,
        contact,
        settings,
        accessToken,
        calendarId: connection.calendarId,
        question: input.question,
        now,
        fetchImpl,
        preface: "That time was just taken. Here are the remaining open times.",
      });
      return reply(refreshed.answer, refreshed.sources);
    }
    let appointment;
    try {
      appointment = await input.store.createCalendarAppointment({
        workspaceId: business.id,
        conversationId: conversation.id,
        customerName: contact.customerName,
        email: contact.email,
        service: contact.service,
        startsAt: start,
        endsAt: end,
        timezone: settings.timezone,
        googleCalendarId: connection.calendarId,
        holdKey: start.toISOString(),
      });
    } catch (error) {
      if (error instanceof BillingError && error.code === "conflict") {
        const refreshed = await offerSlots({
          store: input.store,
          workspaceId: business.id,
          session: active,
          contact,
          settings,
          accessToken,
          calendarId: connection.calendarId,
          question: input.question,
          now,
          fetchImpl,
          preface: "That time was just taken. Here are the remaining open times.",
        });
        return reply(refreshed.answer, refreshed.sources);
      }
      throw error;
    }
    try {
      const event = await withFreshCalendarToken(input.store, business.id, fetchImpl, accessToken, (token) =>
        insertCalendarEvent(
          {
            accessToken: token,
            calendarId: connection.calendarId,
            summary: contact.service ? `${contact.service} — ${contact.customerName}` : `Appointment — ${contact.customerName}`,
            description: [
              "Booked from the BizPilot website chat.",
              `Name: ${contact.customerName}`,
              `Email: ${contact.email}`,
              contact.service ? `Service: ${contact.service}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            start,
            end,
            timeZone: settings.timezone,
          },
          fetchImpl,
        ),
      );
      await input.store.updateCalendarAppointment(appointment.id, business.id, { googleEventId: event.id });
      appointment = { ...appointment, googleEventId: event.id };
    } catch (error) {
      await input.store.deleteCalendarAppointment(appointment.id, business.id);
      if (error instanceof BillingError && error.code === "conflict") {
        const refreshed = await offerSlots({
          store: input.store,
          workspaceId: business.id,
          session: active,
          contact,
          settings,
          accessToken,
          calendarId: connection.calendarId,
          question: input.question,
          now,
          fetchImpl,
          preface: "That time was just taken. Here are the remaining open times.",
        });
        return reply(refreshed.answer, refreshed.sources);
      }
      throw error;
    }
    const emailed = await sendBookingConfirmation({
      store: input.store,
      workspace: business,
      appointment,
      fetchImpl,
    });
    await rememberSession(input.store, active, {
      ...contact,
      offeredSlots: [],
      status: "booked",
    });
    const confirmation = emailed
      ? ` A confirmation email was sent to ${contact.email}.`
      : " The appointment was booked, but the confirmation email could not be sent.";
    return reply(`You're booked for ${picked.label}. The appointment is on the connected calendar.${confirmation}`);
  }

  let accessToken = "";
  try {
    accessToken = await calendarAccessToken(input.store, connection, fetchImpl);
  } catch (error) {
    if (error instanceof BillingError && (error.code === "reconnect" || error.code === "misconfigured")) {
      await new BillingService(input.store).noteWidgetAppointmentRequest({
        workspaceId: business.id,
        userId: business.ownerUserId,
        conversationId: conversation.id,
        question: input.question,
      });
      return reply(DISCONNECTED_CALENDAR_REPLY);
    }
    throw error;
  }
  const offered = await offerSlots({
    store: input.store,
    workspaceId: business.id,
    session: active,
    contact: freshAvailability ? { customerName: "", email: "", service: "" } : contact,
    settings,
    accessToken,
    calendarId: connection.calendarId,
    question: input.question,
    now,
    fetchImpl,
    preface: "",
  });
  return reply(offered.answer, offered.sources);
}

async function withFreshCalendarToken<T>(
  store: BillingStore,
  workspaceId: string,
  fetchImpl: typeof fetch,
  accessToken: string,
  run: (token: string) => Promise<T>,
) {
  try {
    return await run(accessToken);
  } catch (error) {
    if (!(error instanceof BillingError) || error.code !== "unauthorized") throw error;
    const connection = await store.getGoogleCalendarConnection(workspaceId);
    if (!connection || connection.workspaceId !== workspaceId || connection.status !== "connected") {
      throw new BillingError("Google Calendar access was revoked or expired. Connect Google Calendar again.", "reconnect");
    }
    const renewed = await refreshStoredCalendarAccess(store, connection, fetchImpl);
    return run(renewed);
  }
}

async function slotStillOpen(input: {
  store: BillingStore;
  workspaceId: string;
  settings: CalendarBookingSettingsRecord;
  accessToken: string;
  calendarId: string;
  slot: CalendarSlot;
  fetchImpl: typeof fetch;
}) {
  const start = new Date(input.slot.start);
  const end = new Date(input.slot.end);
  const occupiedEnd = new Date(end.getTime() + input.settings.bufferMinutes * 60 * 1000);
  const localBusy = (await input.store.listCalendarAppointments(input.workspaceId))
    .filter((row) => row.workspaceId === input.workspaceId && row.status === "confirmed")
    .map((row) => ({ start: row.startsAt, end: new Date(row.endsAt.getTime() + input.settings.bufferMinutes * 60 * 1000) }));
  const remoteBusy = await withFreshCalendarToken(input.store, input.workspaceId, input.fetchImpl, input.accessToken, (token) =>
    queryCalendarFreeBusy(
      {
        accessToken: token,
        calendarId: input.calendarId,
        timeMin: new Date(start.getTime() - 60 * 1000),
        timeMax: new Date(occupiedEnd.getTime() + 60 * 1000),
      },
      input.fetchImpl,
    ),
  );
  return ![...localBusy, ...remoteBusy].some((interval) => start < interval.end && occupiedEnd > interval.start);
}

async function offerSlots(input: {
  store: BillingStore;
  workspaceId: string;
  session: CalendarBookingSessionRecord;
  contact: { customerName: string; email: string; service: string };
  settings: CalendarBookingSettingsRecord;
  accessToken: string;
  calendarId: string;
  question: string;
  now: Date;
  fetchImpl: typeof fetch;
  preface: string;
}) {
  const window = requestedWindow(input.question, input.now, input.settings.timezone);
  const horizonEnd = new Date(input.now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const rangeStart = window && window.start < input.now ? window.start : input.now;
  const rangeEnd = new Date(Math.max(horizonEnd.getTime(), window?.end.getTime() ?? 0));
  const remoteBusy = await withFreshCalendarToken(input.store, input.workspaceId, input.fetchImpl, input.accessToken, (token) =>
    queryCalendarFreeBusy(
      {
        accessToken: token,
        calendarId: input.calendarId,
        timeMin: rangeStart,
        timeMax: rangeEnd,
      },
      input.fetchImpl,
    ),
  );
  const localBusy = (await input.store.listCalendarAppointments(input.workspaceId))
    .filter((row) => row.workspaceId === input.workspaceId && row.status === "confirmed")
    .map((row) => ({
      start: row.startsAt,
      end: new Date(row.endsAt.getTime() + input.settings.bufferMinutes * 60 * 1000),
    }));
  const busy = [...remoteBusy, ...localBusy];
  let slots = buildAvailableSlots({
    now: input.now,
    settings: input.settings,
    busy,
    window,
  });
  let relaxed = false;
  if (!slots.length && window) {
    const forwardStart = window.end > input.now ? window.end : input.now;
    slots = buildAvailableSlots({
      now: input.now,
      settings: input.settings,
      busy,
      window: { start: forwardStart, end: rangeEnd },
    });
    relaxed = slots.length > 0;
  }
  await input.store.upsertCalendarBookingSession({
    workspaceId: input.workspaceId,
    conversationId: input.session.conversationId,
    customerName: input.contact.customerName,
    email: input.contact.email,
    service: input.contact.service,
    offeredSlots: slots,
    status: slots.length ? "offering" : "collecting",
  });
  if (!slots.length) {
    return {
      answer: "I checked the connected calendar and there are no open times in the next two weeks.",
      sources: [] as WebsiteReplySource[],
    };
  }
  const preface = input.preface.trim()
    ? input.preface
    : relaxed
      ? "There are no open times then. Here are the next open times. Choose one."
      : "Here are the open times on the connected calendar. Choose one.";
  return {
    answer: preface,
    sources: slotSources(slots),
  };
}
