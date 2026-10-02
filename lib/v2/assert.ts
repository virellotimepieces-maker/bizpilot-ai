import { BillingError } from "@/lib/billing/types";
import {
  APPOINTMENT_REQUEST_STATUSES,
  FUTURE_INTEGRATION_PROVIDERS,
  INTEGRATION_CONNECTION_STATUSES,
  KNOWLEDGE_KINDS,
  KNOWLEDGE_SOURCE_TYPES,
  LEAD_STATUSES,
  QUOTE_REQUEST_STATUSES,
  UNANSWERED_STATUSES,
  WIDGET_POSITIONS,
  isOneOf,
  type AppointmentRequestStatus,
  type FutureIntegrationProvider,
  type IntegrationConnectionStatus,
  type KnowledgeKind,
  type KnowledgeSourceType,
  type LeadStatus,
  type QuoteRequestStatus,
  type UnansweredStatus,
  type WidgetPosition,
} from "./enums";

function invalid(message: string): never {
  throw new BillingError(message, "invalid");
}

export function requireKnowledgeKind(value: string): KnowledgeKind {
  if (!isOneOf(value, KNOWLEDGE_KINDS)) invalid("Unknown knowledge kind.");
  return value;
}

export function requireKnowledgeSourceType(value: string): KnowledgeSourceType {
  if (!isOneOf(value, KNOWLEDGE_SOURCE_TYPES)) invalid("Unknown knowledge source type.");
  return value;
}

export function requireLeadStatus(value: string): LeadStatus {
  if (!isOneOf(value, LEAD_STATUSES)) invalid("Unknown lead status.");
  return value;
}

export function requireUnansweredStatus(value: string): UnansweredStatus {
  if (!isOneOf(value, UNANSWERED_STATUSES)) invalid("Unknown unanswered-question status.");
  return value;
}

export function requireQuoteStatus(value: string): QuoteRequestStatus {
  if (!isOneOf(value, QUOTE_REQUEST_STATUSES)) invalid("Unknown quote request status.");
  return value;
}

export function requireAppointmentStatus(value: string): AppointmentRequestStatus {
  if (!isOneOf(value, APPOINTMENT_REQUEST_STATUSES)) invalid("Unknown appointment request status.");
  return value;
}

export function requireIntegrationProvider(value: string): FutureIntegrationProvider {
  if (!isOneOf(value, FUTURE_INTEGRATION_PROVIDERS)) invalid("Unknown integration provider.");
  return value;
}

export function requireIntegrationStatus(value: string): IntegrationConnectionStatus {
  if (!isOneOf(value, INTEGRATION_CONNECTION_STATUSES)) invalid("Unknown integration status.");
  return value;
}

/**
 * WooCommerce and Calendar cannot be stored as connected. Shopify may persist
 * connected/pending after a real OAuth connection. Unknown values still throw.
 */
export function persistFutureIntegrationStatus(
  provider: FutureIntegrationProvider,
  value?: string,
): IntegrationConnectionStatus {
  const status = value === undefined ? "disconnected" : requireIntegrationStatus(value);
  if (provider === "shopify") return status;
  return "disconnected";
}

export function requireWidgetPosition(value: string): WidgetPosition {
  if (!isOneOf(value, WIDGET_POSITIONS)) invalid("Unknown widget position.");
  return value;
}
