import type { KnowledgeEntryRecord } from "./types";

export function isProjectedKnowledgeEntry(entry: Pick<KnowledgeEntryRecord, "sourceRef" | "sourceType">) {
  if (entry.sourceType === "website" || entry.sourceType === "import") return false;
  return entry.sourceRef.trim().length > 0;
}

export function isExtraKnowledgeEntry(entry: Pick<KnowledgeEntryRecord, "sourceRef" | "sourceType">) {
  return entry.sourceType === "manual" && entry.sourceRef.trim() === "";
}
