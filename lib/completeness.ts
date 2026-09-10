import type { KnowledgeBase } from "./types";
import { showsClinicOperations, showsServiceOperations, showsStoreOperations } from "./labels";

export interface CoverageItem {
  key: string;
  label: string;
  filled: boolean;
}

export function knowledgeCoverage(kb: KnowledgeBase | null): {
  percent: number;
  items: CoverageItem[];
} {
  if (!kb) return { percent: 0, items: [] };

  const items: CoverageItem[] = [
    {
      key: "info",
      label: "Business information",
      filled: Boolean(kb.name.trim() && kb.description.trim()),
    },
    {
      key: "offerings",
      label: "Products and/or services",
      filled: kb.offerings.some((o) => o.name.trim()),
    },
    {
      key: "pricing",
      label: "Prices or rates",
      filled:
        Boolean(kb.pricingNotes.trim()) ||
        kb.offerings.some((o) => o.price.trim()),
    },
    {
      key: "hours",
      label: "Availability or operating hours",
      filled: kb.hours.days.some((d) => !d.closed && d.open && d.close),
    },
    {
      key: "policies",
      label: "Policies",
      filled: kb.policies.some((p) => p.title.trim() && p.summary.trim()),
    },
    {
      key: "faqs",
      label: "Frequently asked questions",
      filled: kb.faqs.some((f) => f.question.trim() && f.answer.trim()),
    },
    {
      key: "docs",
      label: "Custom knowledge",
      filled: kb.documents.some((d) => d.title.trim() && d.body.trim()),
    },
    {
      key: "contact",
      label: "Contact details",
      filled: Boolean(kb.contact.email.trim() || kb.contact.phone.trim()),
    },
    {
      key: "escalation",
      label: "Human-escalation rules",
      filled: Boolean(
        kb.escalation.handoffMessage.trim() &&
          kb.escalation.alwaysEscalateTopics.trim(),
      ),
    },
  ];

  if (showsStoreOperations(kb.businessType)) {
    items.push({
      key: "store",
      label: "Store operations (shipping, stock, payments)",
      filled: Boolean(
        kb.store?.shippingPolicy.trim() ||
          kb.store?.stockMessaging.trim() ||
          kb.store?.paymentMethods.trim(),
      ),
    });
  }
  if (showsServiceOperations(kb.businessType)) {
    items.push({
      key: "service",
      label: "Service operations (area, booking, call-out)",
      filled: Boolean(
        kb.serviceOps?.serviceArea.trim() ||
          kb.serviceOps?.bookingLeadTime.trim(),
      ),
    });
  }
  if (showsClinicOperations(kb.businessType)) {
    items.push({
      key: "clinic",
      label: "Clinic operations (booking, insurance, emergencies)",
      filled: Boolean(
        kb.clinicOps?.appointmentBooking.trim() ||
          kb.clinicOps?.insuranceAccepted.trim(),
      ),
    });
  }

  const filled = items.filter((i) => i.filled).length;
  return {
    percent: Math.round((filled / items.length) * 100),
    items,
  };
}
