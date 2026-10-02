import type { ReplyIntent } from "@/lib/types";
import { CUSTOMER_INTENTS, type CustomerIntent } from "./enums";

const FROM_REPLY_INTENT: Record<ReplyIntent, CustomerIntent> = {
  hours: "general_question",
  contact: "general_question",
  offerings: "product_interest",
  pricing: "pricing_inquiry",
  availability: "product_interest",
  policy: "general_question",
  faq: "general_question",
  document: "general_question",
  store_shipping: "general_question",
  store_stock: "product_interest",
  store_payment: "purchase_intent",
  service_area: "service_interest",
  appointments: "appointment_request",
  insurance: "general_question",
  emergency: "support_issue",
  complaint: "support_issue",
  medical_advice: "support_issue",
  legal: "support_issue",
  account_specific: "support_issue",
  unknown: "general_question",
};

const HIGH_INTENT: ReadonlySet<CustomerIntent> = new Set([
  "purchase_intent",
  "quote_request",
  "appointment_request",
]);

export function customerIntentFromReplyIntent(intent: ReplyIntent): CustomerIntent {
  return FROM_REPLY_INTENT[intent] ?? "general_question";
}

export function isHighIntent(intent: CustomerIntent) {
  return HIGH_INTENT.has(intent);
}

export function parseCustomerIntent(value: string | null | undefined): CustomerIntent {
  if (value && (CUSTOMER_INTENTS as readonly string[]).includes(value)) {
    return value as CustomerIntent;
  }
  return "general_question";
}
