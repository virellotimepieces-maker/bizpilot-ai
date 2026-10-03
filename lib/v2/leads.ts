import { BillingError } from "@/lib/billing/types";
import { requireLeadStatus } from "./assert";
import { CUSTOMER_INTENTS, type CustomerIntent, type LeadStatus } from "./enums";
import { parseCustomerIntent } from "./intents";
import type { LeadInput, LeadRecord } from "./types";

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  qualified: "Qualified",
  follow_up: "Follow up",
  converted: "Converted",
  closed: "Closed",
};

export const CUSTOMER_INTENT_LABEL: Record<CustomerIntent, string> = {
  general_question: "General question",
  product_interest: "Product interest",
  service_interest: "Service interest",
  pricing_inquiry: "Pricing inquiry",
  purchase_intent: "Purchase intent",
  quote_request: "Quote request",
  appointment_request: "Appointment request",
  support_issue: "Support issue",
};

export function serializeLead(row: LeadRecord) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    interest: row.interest,
    request: row.request,
    notes: row.notes,
    source: row.source,
    status: row.status,
    intent: row.intent,
    aiSummary: row.aiSummary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SerializedLead = ReturnType<typeof serializeLead>;

export function leadDisplayName(row: Pick<LeadRecord, "name" | "email">) {
  if (row.name.trim()) return row.name.trim();
  if (row.email.trim()) return row.email.trim();
  return "Unnamed visitor";
}

export function filterLeads(
  rows: LeadRecord[],
  input: { status?: string | null; query?: string | null },
) {
  const status = input.status && input.status !== "all" ? requireLeadStatus(input.status) : null;
  const needle = (input.query ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!needle) return true;
    return `${row.name}\n${row.email}\n${row.phone}\n${row.interest}\n${row.request}\n${row.notes}`
      .toLowerCase()
      .includes(needle);
  });
}

export function leadCounts(rows: LeadRecord[]) {
  return {
    total: rows.length,
    new: rows.filter((row) => row.status === "new").length,
    qualified: rows.filter((row) => row.status === "qualified").length,
    follow_up: rows.filter((row) => row.status === "follow_up").length,
  };
}

export function findLeadForConversation(rows: LeadRecord[], conversationId: string) {
  return rows.find((row) => row.conversationId === conversationId) ?? null;
}

export function findLeadForContact(
  rows: LeadRecord[],
  input: { workspaceId: string; conversationId?: string | null; email?: string | null },
) {
  const scoped = rows.filter((row) => row.workspaceId === input.workspaceId);
  const email = (input.email ?? "").trim().toLowerCase();
  if (email) {
    const byEmail = scoped.find((row) => row.email.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  if (!input.conversationId) return null;
  const byConversation = scoped.find((row) => row.conversationId === input.conversationId) ?? null;
  if (!byConversation) return null;
  if (!email || !byConversation.email.trim() || byConversation.email.trim().toLowerCase() === email) {
    return byConversation;
  }
  return null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function parseLeadPatch(body: unknown): LeadInput {
  if (!body || typeof body !== "object") {
    throw new BillingError("Lead updates are required.", "invalid");
  }
  const row = body as Record<string, unknown>;
  const patch: LeadInput = {};
  if ("name" in row) patch.name = asString(row.name).trim().slice(0, 80);
  if ("email" in row) patch.email = asString(row.email).trim().slice(0, 120);
  if ("phone" in row) patch.phone = asString(row.phone).trim().slice(0, 32);
  if ("interest" in row) patch.interest = asString(row.interest).trim().slice(0, 160);
  if ("notes" in row) patch.notes = asString(row.notes).trim().slice(0, 2000);
  if ("status" in row) patch.status = requireLeadStatus(asString(row.status));
  if ("intent" in row) {
    const intent = asString(row.intent);
    if (intent && !(CUSTOMER_INTENTS as readonly string[]).includes(intent)) {
      throw new BillingError("Unknown customer intent.", "invalid");
    }
    patch.intent = parseCustomerIntent(intent);
  }
  if (Object.keys(patch).length === 0) {
    throw new BillingError("No lead fields to update.", "invalid");
  }
  return patch;
}
