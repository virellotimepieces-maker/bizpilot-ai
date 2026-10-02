import type { BillingStore } from "@/lib/billing/store";
import type { KnowledgeBase } from "@/lib/types";
import { isProjectedKnowledgeEntry } from "./entry-scope";
import { knowledgeBaseToDraftEntries } from "./knowledge-entries";
import type { KnowledgeEntryRecord } from "./types";

export { isExtraKnowledgeEntry, isProjectedKnowledgeEntry } from "./entry-scope";

/**
 * Upserts searchable KnowledgeEntry rows from Workspace.knowledge JSON.
 * JSON remains the authoring source of truth. Disabled flags on existing
 * projected rows are preserved across re-sync. Extra owner facts (empty
 * sourceRef) are left alone.
 */
export async function syncProjectedKnowledgeEntries(
  store: BillingStore,
  workspaceId: string,
  knowledge: KnowledgeBase,
): Promise<KnowledgeEntryRecord[]> {
  const drafts = knowledgeBaseToDraftEntries(knowledge);
  const draftRefs = new Set(drafts.map((draft) => draft.sourceRef));
  const existing = await store.listKnowledgeEntries(workspaceId);
  const projected = existing.filter(isProjectedKnowledgeEntry);

  for (const draft of drafts) {
    const match = projected.find((row) => row.sourceRef === draft.sourceRef);
    if (match) {
      await store.updateKnowledgeEntry(match.id, workspaceId, {
        kind: draft.kind,
        title: draft.title,
        content: draft.content,
        sourceType: draft.sourceType,
        sourceLabel: draft.sourceLabel,
        sourceUrl: draft.sourceUrl,
        sourceRef: draft.sourceRef,
        enabled: match.enabled,
      });
    } else {
      await store.createKnowledgeEntry(workspaceId, draft);
    }
  }

  for (const row of projected) {
    if (!draftRefs.has(row.sourceRef)) {
      await store.deleteKnowledgeEntry(row.id, workspaceId);
    }
  }

  return store.listKnowledgeEntries(workspaceId);
}
