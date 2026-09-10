import type { ReplyIntent, ReplySource } from "./types";

export const INTENT_LABEL: Record<ReplyIntent, string> = {
  hours: "Hours",
  contact: "Contact",
  offerings: "Offerings",
  pricing: "Prices / rates",
  availability: "Availability",
  policy: "Policy",
  faq: "FAQ",
  document: "Custom knowledge",
  store_shipping: "Shipping",
  store_stock: "Stock",
  store_payment: "Payments",
  service_area: "Service area",
  appointments: "Appointments",
  insurance: "Insurance",
  emergency: "Emergency",
  complaint: "Complaint",
  medical_advice: "Clinical question",
  legal: "Legal / dispute",
  account_specific: "Account-specific",
  unknown: "General",
};

export function sourceLabel(source: ReplySource) {
  if (source.visibility === "internal") return `${source.title} (internal)`;
  return source.title;
}
