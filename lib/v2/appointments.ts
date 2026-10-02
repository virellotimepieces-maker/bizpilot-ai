import { BillingError } from "@/lib/billing/types";
import { requireAppointmentStatus } from "./assert";
import { APPOINTMENT_REQUEST_STATUSES, type AppointmentRequestStatus } from "./enums";
import type { AppointmentRequestRecord, AppointmentRequestWrite } from "./types";

/** Owner-marked statuses that still need a person. There is no confirmed status. */
export const OPEN_APPOINTMENT_STATUSES: readonly AppointmentRequestStatus[] = [
  "requested",
  "in_review",
];

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentRequestStatus, string> = {
  requested: "Requested",
  in_review: "In review",
  declined: "Declined",
  closed: "Closed",
};

export const APPOINTMENT_REQUEST_HINT =
  "Appointment rows are requests to review. BizPilot does not confirm a booking or write to a calendar.";

export const APPOINTMENT_DECLINED_HINT =
  "Declined means you marked that you cannot take this request. It is not a calendar event being declined.";

const APPOINTMENT_WORD_RE = /\bappointments?\b/i;
const BOOK_SLOT_RE =
  /\b(book|schedule|reserv(?:e|ation)|set up|make)\s+(a|an|my|our)?\s*(appointment|visit|consult(?:ation)?|fitting|viewing|checkup|check-up|slot)\b/i;
const COME_IN_RE = /\b(can i|could i|want to|like to)\s+(come in|come by|stop by|stop in)\b/i;
const NEW_PATIENT_RE = /\bnew patient\b/i;
const WEEKDAY_RE =
  /\b(?:this |next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight)(?:\s+(morning|afternoon|evening|night))?(?:\s+at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i;
const CLOCK_RE = /\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;

export function isAppointmentRequestQuestion(question: string) {
  const text = question.trim();
  if (!text) return false;
  return (
    APPOINTMENT_WORD_RE.test(text) ||
    BOOK_SLOT_RE.test(text) ||
    COME_IN_RE.test(text) ||
    NEW_PATIENT_RE.test(text)
  );
}

export function extractRequestedService(question: string) {
  const text = question.trim();
  const match = text.match(
    /\b(?:appointment|visit|consult(?:ation)?|fitting|viewing)\s+(?:for|on)\s+(.+)$/i,
  );
  if (!match?.[1]) return "";
  let value = match[1].replace(/[?.!]+$/g, "").trim();
  value = value.replace(WEEKDAY_RE, "").replace(CLOCK_RE, "").replace(/\s+/g, " ").trim();
  value = value.replace(/\s+(?:on|for|at)$/i, "").trim();
  value = value.replace(/^(this|next|a|an|the)\s+/i, "").trim().slice(0, 160);
  if (!value || /^(appointment|visit|consult(?:ation)?|this|it|that|one)$/i.test(value)) return "";
  return value;
}

export function extractPreferredAt(question: string) {
  const text = question.trim();
  const weekday = text.match(WEEKDAY_RE);
  if (weekday?.[0]) return weekday[0].trim().slice(0, 80);
  const clock = text.match(CLOCK_RE);
  if (clock?.[0]) return clock[0].replace(/^at\s+/i, "").trim().slice(0, 80);
  return "";
}

export function serializeAppointmentRequest(row: AppointmentRequestRecord) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    leadId: row.leadId,
    customerName: row.customerName,
    email: row.email,
    phone: row.phone,
    requestedService: row.requestedService,
    preferredAt: row.preferredAt,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SerializedAppointmentRequest = ReturnType<typeof serializeAppointmentRequest>;

export function appointmentDisplayName(
  row: Pick<AppointmentRequestRecord, "customerName" | "email">,
) {
  if (row.customerName.trim()) return row.customerName.trim();
  if (row.email.trim()) return row.email.trim();
  return "Unnamed visitor";
}

export function filterAppointmentRequests(
  rows: AppointmentRequestRecord[],
  input: { status?: string | null; query?: string | null },
) {
  const status =
    input.status && input.status !== "all" ? requireAppointmentStatus(input.status) : null;
  const needle = (input.query ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!needle) return true;
    return `${row.customerName}\n${row.email}\n${row.phone}\n${row.requestedService}\n${row.preferredAt}\n${row.notes}`
      .toLowerCase()
      .includes(needle);
  });
}

export function appointmentCounts(rows: AppointmentRequestRecord[]) {
  return {
    total: rows.length,
    requested: rows.filter((row) => row.status === "requested").length,
    in_review: rows.filter((row) => row.status === "in_review").length,
    declined: rows.filter((row) => row.status === "declined").length,
    closed: rows.filter((row) => row.status === "closed").length,
    open: rows.filter((row) => isOpenAppointmentStatus(row.status)).length,
  };
}

export function isOpenAppointmentStatus(status: AppointmentRequestStatus) {
  return OPEN_APPOINTMENT_STATUSES.includes(status);
}

export function findOpenAppointmentForConversation(
  rows: AppointmentRequestRecord[],
  conversationId: string,
) {
  return (
    rows.find((row) => row.conversationId === conversationId && isOpenAppointmentStatus(row.status)) ??
    null
  );
}

export function appointmentsForConversation(
  rows: AppointmentRequestRecord[],
  conversationId: string,
) {
  return rows.filter((row) => row.conversationId === conversationId);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** Owners may mark status and private notes only — never a confirmed booking. */
export function parseAppointmentPatch(body: unknown): AppointmentRequestWrite {
  if (!body || typeof body !== "object") {
    throw new BillingError("Appointment request updates are required.", "invalid");
  }
  const row = body as Record<string, unknown>;
  const patch: AppointmentRequestWrite = {};
  if ("notes" in row) patch.notes = asString(row.notes).trim().slice(0, 2000);
  if ("status" in row) {
    const status = asString(row.status);
    if (status && !(APPOINTMENT_REQUEST_STATUSES as readonly string[]).includes(status)) {
      throw new BillingError("Unknown appointment request status.", "invalid");
    }
    patch.status = requireAppointmentStatus(status);
  }
  if (Object.keys(patch).length === 0) {
    throw new BillingError("No appointment request fields to update.", "invalid");
  }
  return patch;
}

export function shouldPromoteToAppointmentIntent(current: string) {
  return (
    current === "general_question" ||
    current === "product_interest" ||
    current === "service_interest" ||
    current === "pricing_inquiry" ||
    current === "quote_request"
  );
}
