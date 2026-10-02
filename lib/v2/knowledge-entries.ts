import type { KnowledgeBase } from "@/lib/types";
import type { KnowledgeKind, KnowledgeSourceType } from "./enums";
import type { KnowledgeEntryInput } from "./types";

function compact(parts: Array<string | undefined | null>) {
  return parts.map((part) => (part ?? "").trim()).filter(Boolean).join("\n");
}

function draft(
  kind: KnowledgeKind,
  title: string,
  content: string,
  extra?: Partial<Pick<KnowledgeEntryInput, "sourceType" | "sourceLabel" | "sourceRef" | "sourceUrl">>,
): KnowledgeEntryInput | null {
  const nextTitle = title.trim();
  const nextContent = content.trim();
  if (!nextTitle || !nextContent) return null;
  return {
    kind,
    title: nextTitle,
    content: nextContent,
    enabled: true,
    sourceType: extra?.sourceType ?? "manual",
    sourceUrl: extra?.sourceUrl ?? "",
    sourceLabel: extra?.sourceLabel ?? "Approved business knowledge",
    sourceRef: extra?.sourceRef ?? "",
  };
}

function push(list: KnowledgeEntryInput[], entry: KnowledgeEntryInput | null) {
  if (entry) list.push(entry);
}

/**
 * Projects the existing Workspace.knowledge JSON into V2 knowledge-entry drafts.
 * Does not write to the database. Call syncProjectedKnowledgeEntries after a
 * knowledge save (or when loading the Knowledge Engine) to materialize rows.
 * Existing JSON remains the live authoring source of truth.
 */
export function knowledgeBaseToDraftEntries(kb: KnowledgeBase | null | undefined): KnowledgeEntryInput[] {
  if (!kb) return [];
  const entries: KnowledgeEntryInput[] = [];
  const source: KnowledgeSourceType = "manual";

  push(
    entries,
    draft(
      "business",
      kb.name || "Business profile",
      compact([kb.name, kb.tagline, kb.description, kb.industry ? `Industry: ${kb.industry}` : ""]),
      { sourceType: source, sourceLabel: "Business profile", sourceRef: "knowledge.business" },
    ),
  );

  const contact = compact([
    kb.contact.email && `Email: ${kb.contact.email}`,
    kb.contact.phone && `Phone: ${kb.contact.phone}`,
    kb.contact.address && `Address: ${kb.contact.address}`,
    kb.contact.website && `Website: ${kb.contact.website}`,
    kb.contact.extra,
  ]);
  push(
    entries,
    draft("business", "Contact", contact, {
      sourceType: source,
      sourceLabel: "Contact",
      sourceRef: "knowledge.contact",
    }),
  );

  const hours = compact([
    kb.hours.timezone && `Timezone: ${kb.hours.timezone}`,
    kb.hours.notes,
    ...kb.hours.days.map((day) =>
      day.closed ? `${day.day}: closed` : `${day.day}: ${day.open}–${day.close}`,
    ),
  ]);
  push(
    entries,
    draft("business", "Hours", hours, {
      sourceType: source,
      sourceLabel: "Hours",
      sourceRef: "knowledge.hours",
    }),
  );

  if (kb.pricingNotes.trim()) {
    push(
      entries,
      draft("policy", "Pricing notes", kb.pricingNotes, {
        sourceType: source,
        sourceLabel: "Pricing",
        sourceRef: "knowledge.pricingNotes",
      }),
    );
  }

  for (const offering of kb.offerings) {
    const kind: KnowledgeKind = offering.kind === "service" ? "service" : "product";
    push(
      entries,
      draft(
        kind,
        offering.name,
        compact([offering.summary, offering.price && `Price: ${offering.price}`, offering.availability, offering.details]),
        { sourceType: source, sourceLabel: offering.kind === "service" ? "Service" : "Product", sourceRef: offering.id },
      ),
    );
  }

  for (const policy of kb.policies) {
    push(
      entries,
      draft("policy", policy.title, policy.summary, {
        sourceType: source,
        sourceLabel: "Policy",
        sourceRef: policy.id,
      }),
    );
  }

  for (const faq of kb.faqs) {
    push(
      entries,
      draft("faq", faq.question, faq.answer, {
        sourceType: source,
        sourceLabel: "FAQ",
        sourceRef: faq.id,
      }),
    );
  }

  for (const document of kb.documents) {
    push(
      entries,
      draft("document", document.title, document.body, {
        sourceType: "document",
        sourceLabel: document.visibility === "internal" ? "Internal document" : "Document",
        sourceRef: document.id,
      }),
    );
  }

  if (kb.store) {
    push(
      entries,
      draft(
        "policy",
        "Store operations",
        compact([
          kb.store.shippingPolicy && `Shipping: ${kb.store.shippingPolicy}`,
          kb.store.stockMessaging && `Stock: ${kb.store.stockMessaging}`,
          kb.store.paymentMethods && `Payments: ${kb.store.paymentMethods}`,
          kb.store.cashOnDelivery ? "Cash on delivery: yes" : "",
          kb.store.orderTrackingNotes && `Tracking: ${kb.store.orderTrackingNotes}`,
        ]),
        { sourceType: source, sourceLabel: "Store operations", sourceRef: "knowledge.store" },
      ),
    );
  }

  if (kb.serviceOps) {
    push(
      entries,
      draft(
        "service",
        "Service operations",
        compact([
          kb.serviceOps.serviceArea && `Service area: ${kb.serviceOps.serviceArea}`,
          kb.serviceOps.bookingLeadTime && `Lead time: ${kb.serviceOps.bookingLeadTime}`,
          kb.serviceOps.onsiteVsRemote,
          kb.serviceOps.emergencyCallout,
        ]),
        { sourceType: source, sourceLabel: "Service operations", sourceRef: "knowledge.serviceOps" },
      ),
    );
  }

  if (kb.clinicOps) {
    push(
      entries,
      draft(
        "policy",
        "Clinic operations",
        compact([
          kb.clinicOps.appointmentBooking,
          kb.clinicOps.insuranceAccepted && `Insurance: ${kb.clinicOps.insuranceAccepted}`,
          kb.clinicOps.newPatientProcess,
          kb.clinicOps.emergencyProtocol,
          kb.clinicOps.clinicalAdvicePolicy,
        ]),
        { sourceType: source, sourceLabel: "Clinic operations", sourceRef: "knowledge.clinicOps" },
      ),
    );
  }

  return entries;
}

export function knowledgeEntryMatchesQuery(title: string, content: string, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return `${title}\n${content}`.toLowerCase().includes(needle);
}

export function approvedKnowledgeOnly<T extends { enabled: boolean }>(entries: T[]) {
  return entries.filter((entry) => entry.enabled);
}
