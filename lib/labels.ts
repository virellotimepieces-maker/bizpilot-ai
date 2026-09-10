import type { BusinessType, OfferingKind } from "./types";

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  online_store: "Online store",
  service: "Service business",
  clinic: "Clinic / appointments",
  custom: "Other / custom",
};

export const BUSINESS_TYPE_HINT: Record<BusinessType, string> = {
  online_store:
    "Catalog, prices, shipping, stock, and payments — only if you sell goods.",
  service:
    "Services, rates, coverage area, and how people book the work.",
  clinic:
    "Care offerings, hours, booking, insurance — never auto-answers clinical advice.",
  custom: "Use the shared knowledge base. Add only the fields you need.",
};

export function offeringLabel(type: BusinessType, plural = true) {
  if (type === "online_store") return plural ? "Products" : "Product";
  if (type === "clinic") return plural ? "Care offerings" : "Care offering";
  if (type === "service") return plural ? "Services" : "Service";
  return plural ? "Products & services" : "Offering";
}

export function offeringKindLabel(kind: OfferingKind) {
  return kind === "product" ? "Product" : "Service";
}

export function defaultOfferingKind(type: BusinessType): OfferingKind {
  return type === "online_store" ? "product" : "service";
}

export function showsStoreOperations(type: BusinessType) {
  return type === "online_store";
}

export function showsServiceOperations(type: BusinessType) {
  return type === "service";
}

export function showsClinicOperations(type: BusinessType) {
  return type === "clinic";
}

export const DAY_LABEL: Record<string, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
