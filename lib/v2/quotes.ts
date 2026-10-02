import { BillingError } from "@/lib/billing/types";
import { requireQuoteStatus } from "./assert";
import { QUOTE_REQUEST_STATUSES, type QuoteRequestStatus } from "./enums";
import type { QuoteRequestRecord, QuoteRequestWrite } from "./types";

/** Owner-marked statuses that still need a person. `sent` is not open — and is not an issued quote. */
export const OPEN_QUOTE_STATUSES: readonly QuoteRequestStatus[] = ["requested", "in_review"];

export const QUOTE_STATUS_LABEL: Record<QuoteRequestStatus, string> = {
  requested: "Requested",
  in_review: "In review",
  sent: "Marked sent",
  closed: "Closed",
};

export const QUOTE_SENT_HINT =
  "Marked sent means you recorded that you sent a quote. BizPilot did not issue a price or a quote document.";

export const QUOTE_REQUEST_HINT =
  "Quote rows are requests to review. BizPilot never issues a price, a quote document, or a confirmed quote.";

const QUOTE_LANGUAGE_RE =
  /\b(quot(?:e|es|ing|ation)s?|estimat(?:e|es|ing)|rfp|request for (?:a )?proposal)\b/i;
const REQUEST_PRICE_RE = /\b(request|need|want|ask(?:ing)? for) (?:a |an )?(?:price|proposal)\b/i;

export function isQuoteRequestQuestion(question: string) {
  const text = question.trim();
  if (!text) return false;
  return QUOTE_LANGUAGE_RE.test(text) || REQUEST_PRICE_RE.test(text);
}

export function extractQuotedProductService(question: string) {
  const text = question.trim();
  const match = text.match(
    /\b(?:quot(?:e|es|ation)|estimat(?:e|es))\s+(?:me\s+)?(?:for|on|of)\s+(.+)$/i,
  );
  if (!match?.[1]) return "";
  const value = match[1].replace(/[?.!]+$/g, "").trim().slice(0, 160);
  if (!value || /^(this|it|that|one|a quote|an estimate|a quotation)$/i.test(value)) return "";
  if (/\$|\b\d+(\.\d+)?\s*(usd|dollars?)\b/i.test(value)) return "";
  return value;
}

export function serializeQuoteRequest(row: QuoteRequestRecord) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    leadId: row.leadId,
    customerName: row.customerName,
    email: row.email,
    phone: row.phone,
    productService: row.productService,
    requirements: row.requirements,
    notes: row.notes,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SerializedQuoteRequest = ReturnType<typeof serializeQuoteRequest>;

export function quoteDisplayName(row: Pick<QuoteRequestRecord, "customerName" | "email">) {
  if (row.customerName.trim()) return row.customerName.trim();
  if (row.email.trim()) return row.email.trim();
  return "Unnamed visitor";
}

export function filterQuoteRequests(
  rows: QuoteRequestRecord[],
  input: { status?: string | null; query?: string | null },
) {
  const status = input.status && input.status !== "all" ? requireQuoteStatus(input.status) : null;
  const needle = (input.query ?? "").trim().toLowerCase();
  return rows.filter((row) => {
    if (status && row.status !== status) return false;
    if (!needle) return true;
    return `${row.customerName}\n${row.email}\n${row.phone}\n${row.productService}\n${row.requirements}\n${row.notes}`
      .toLowerCase()
      .includes(needle);
  });
}

export function quoteCounts(rows: QuoteRequestRecord[]) {
  return {
    total: rows.length,
    requested: rows.filter((row) => row.status === "requested").length,
    in_review: rows.filter((row) => row.status === "in_review").length,
    sent: rows.filter((row) => row.status === "sent").length,
    closed: rows.filter((row) => row.status === "closed").length,
    open: rows.filter((row) => isOpenQuoteStatus(row.status)).length,
  };
}

export function isOpenQuoteStatus(status: QuoteRequestStatus) {
  return OPEN_QUOTE_STATUSES.includes(status);
}

export function findOpenQuoteForConversation(rows: QuoteRequestRecord[], conversationId: string) {
  return (
    rows.find((row) => row.conversationId === conversationId && isOpenQuoteStatus(row.status)) ??
    null
  );
}

export function quotesForConversation(rows: QuoteRequestRecord[], conversationId: string) {
  return rows.filter((row) => row.conversationId === conversationId);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

/** Owners may mark status and private notes only — never a price or an issued quote. */
export function parseQuotePatch(body: unknown): QuoteRequestWrite {
  if (!body || typeof body !== "object") {
    throw new BillingError("Quote request updates are required.", "invalid");
  }
  const row = body as Record<string, unknown>;
  const patch: QuoteRequestWrite = {};
  if ("notes" in row) patch.notes = asString(row.notes).trim().slice(0, 2000);
  if ("status" in row) {
    const status = asString(row.status);
    if (status && !(QUOTE_REQUEST_STATUSES as readonly string[]).includes(status)) {
      throw new BillingError("Unknown quote request status.", "invalid");
    }
    patch.status = requireQuoteStatus(status);
  }
  if (Object.keys(patch).length === 0) {
    throw new BillingError("No quote request fields to update.", "invalid");
  }
  return patch;
}

export function shouldPromoteToQuoteIntent(current: string) {
  return (
    current === "general_question" ||
    current === "product_interest" ||
    current === "service_interest" ||
    current === "pricing_inquiry"
  );
}
