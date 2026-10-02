import type { KnowledgeKind } from "./enums";

export const KNOWLEDGE_KIND_LABEL: Record<KnowledgeKind, string> = {
  faq: "FAQ",
  business: "Business",
  product: "Product",
  service: "Service",
  policy: "Policy",
  website: "Website",
  manual: "Manual",
  document: "Document",
};

export const EXTRA_FACT_KINDS: KnowledgeKind[] = ["faq", "product", "service", "policy", "manual", "document"];
