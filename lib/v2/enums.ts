/** V2 domain vocabularies. Stored as strings in Postgres; validated in app code. */

export const CUSTOMER_INTENTS = [
  "general_question",
  "product_interest",
  "service_interest",
  "pricing_inquiry",
  "purchase_intent",
  "quote_request",
  "appointment_request",
  "support_issue",
] as const;

export type CustomerIntent = (typeof CUSTOMER_INTENTS)[number];

export const LEAD_STATUSES = ["new", "qualified", "follow_up", "converted", "closed"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const INBOX_STATUSES = ["open", "resolved"] as const;

export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const CONVERSATION_CHANNELS = ["website", "email", "social"] as const;

export type ConversationChannel = (typeof CONVERSATION_CHANNELS)[number];

export const KNOWLEDGE_KINDS = [
  "faq",
  "business",
  "product",
  "service",
  "policy",
  "website",
  "manual",
  "document",
] as const;

export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export const KNOWLEDGE_SOURCE_TYPES = ["manual", "website", "import", "document"] as const;

export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const UNANSWERED_STATUSES = ["open", "answered", "ignored"] as const;

export type UnansweredStatus = (typeof UNANSWERED_STATUSES)[number];

/** Quotes are requests only. Never treat these as issued/confirmed quotes. */
export const QUOTE_REQUEST_STATUSES = ["requested", "in_review", "sent", "closed"] as const;

export type QuoteRequestStatus = (typeof QUOTE_REQUEST_STATUSES)[number];

/**
 * Appointment rows are requests. "confirmed" is intentionally absent until a
 * real calendar integration can verify a booking.
 */
export const APPOINTMENT_REQUEST_STATUSES = ["requested", "in_review", "declined", "closed"] as const;

export type AppointmentRequestStatus = (typeof APPOINTMENT_REQUEST_STATUSES)[number];

export const WIDGET_POSITIONS = ["bottom-right", "bottom-left"] as const;

export type WidgetPosition = (typeof WIDGET_POSITIONS)[number];

export const FUTURE_INTEGRATION_PROVIDERS = ["shopify", "woocommerce", "calendar"] as const;

export type FutureIntegrationProvider = (typeof FUTURE_INTEGRATION_PROVIDERS)[number];

export const INTEGRATION_CONNECTION_STATUSES = ["disconnected", "pending", "connected"] as const;

export type IntegrationConnectionStatus = (typeof INTEGRATION_CONNECTION_STATUSES)[number];

export const V2_NOTIFICATION_TYPES = [
  "new_lead",
  "qualified_lead",
  "high_intent",
  "unanswered_question",
  "quote_request",
  "appointment_request",
] as const;

export type V2NotificationType = (typeof V2_NOTIFICATION_TYPES)[number];

export const OWNER_NOTIFICATION_TYPES = [
  "usage_limit",
  "payment_failed",
  "canceled",
  "activated",
  "website_conflict",
  "website_sync_error",
  "human_needed",
  ...V2_NOTIFICATION_TYPES,
] as const;

export type OwnerNotificationType = (typeof OWNER_NOTIFICATION_TYPES)[number];

export function isOneOf<T extends string>(value: string, allowed: readonly T[]): value is T {
  return (allowed as readonly string[]).includes(value);
}
