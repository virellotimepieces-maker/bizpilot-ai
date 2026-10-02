import { emptyContact } from "@/lib/empty-knowledge";
import type { KnowledgeBase } from "@/lib/types";
import { isExtraKnowledgeEntry, isProjectedKnowledgeEntry } from "./entry-scope";
import type { KnowledgeEntryRecord } from "./types";

/**
 * Applies Knowledge Engine publication flags onto the JSON knowledge used
 * for customer replies. Disabled projected facts are stripped. Extra owner
 * facts that are enabled are appended as public documents. Escalation rules
 * stay on the JSON object.
 */
export function publishedKnowledgeBase(
  knowledge: KnowledgeBase | null,
  entries: KnowledgeEntryRecord[],
): KnowledgeBase | null {
  if (!knowledge) return null;
  if (!entries.length) return knowledge;

  const next: KnowledgeBase = {
    ...knowledge,
    contact: { ...knowledge.contact },
    hours: {
      ...knowledge.hours,
      days: knowledge.hours.days.map((day) => ({ ...day })),
    },
    offerings: knowledge.offerings.map((row) => ({ ...row })),
    policies: knowledge.policies.map((row) => ({ ...row })),
    faqs: knowledge.faqs.map((row) => ({ ...row })),
    documents: knowledge.documents.map((row) => ({ ...row })),
    store: knowledge.store ? { ...knowledge.store } : undefined,
    serviceOps: knowledge.serviceOps ? { ...knowledge.serviceOps } : undefined,
    clinicOps: knowledge.clinicOps ? { ...knowledge.clinicOps } : undefined,
    escalation: { ...knowledge.escalation },
  };

  const disabled = new Set(
    entries.filter((row) => isProjectedKnowledgeEntry(row) && !row.enabled).map((row) => row.sourceRef),
  );

  if (disabled.has("knowledge.business")) {
    next.name = "";
    next.tagline = "";
    next.description = "";
    next.industry = "";
  }
  if (disabled.has("knowledge.contact")) {
    next.contact = emptyContact();
  }
  if (disabled.has("knowledge.hours")) {
    next.hours = { ...next.hours, notes: "", days: next.hours.days.map((day) => ({ ...day, closed: true })) };
  }
  if (disabled.has("knowledge.pricingNotes")) {
    next.pricingNotes = "";
  }
  if (disabled.has("knowledge.store")) {
    next.store = undefined;
  }
  if (disabled.has("knowledge.serviceOps")) {
    next.serviceOps = undefined;
  }
  if (disabled.has("knowledge.clinicOps")) {
    next.clinicOps = undefined;
  }

  next.offerings = next.offerings.filter((row) => !disabled.has(row.id));
  next.policies = next.policies.filter((row) => !disabled.has(row.id));
  next.faqs = next.faqs.filter((row) => !disabled.has(row.id));
  next.documents = next.documents.filter((row) => !disabled.has(row.id));

  const extras = entries.filter((row) => row.enabled && isExtraKnowledgeEntry(row));
  if (extras.length) {
    next.documents = [
      ...next.documents,
      ...extras.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.content,
        visibility: "public" as const,
      })),
    ];
  }

  return next;
}
