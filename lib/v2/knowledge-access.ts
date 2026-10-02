import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import type { BillingStore } from "@/lib/billing/store";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { emptyKnowledge, normalizeKnowledge } from "@/lib/empty-knowledge";
import type { KnowledgeBase } from "@/lib/types";
import { syncProjectedKnowledgeEntries } from "./sync-knowledge";
import type { KnowledgeEntryRecord, UnansweredQuestionRecord } from "./types";

export async function requirePaidKnowledgeContext() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspaces = await store.listWorkspacesForUser(userId);
  const workspace = workspaces[0];
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const service = new BillingService(store);
  const paid = await service.requirePaidWorkspace(userId, workspace.id);
  return { store, ...paid };
}

export function serializeKnowledgeEntry(row: KnowledgeEntryRecord) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    title: row.title,
    content: row.content,
    enabled: row.enabled,
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    sourceRef: row.sourceRef,
    lastUpdatedAt: row.lastUpdatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeUnansweredQuestion(row: UnansweredQuestionRecord) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    question: row.question,
    detectedLanguage: row.detectedLanguage,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}

export async function loadKnowledgeEngine(store: BillingStore, workspaceId: string, knowledge: KnowledgeBase) {
  const entries = await syncProjectedKnowledgeEntries(store, workspaceId, knowledge);
  const unanswered = await store.listUnansweredQuestions(workspaceId);
  return {
    knowledge,
    entries: entries.map(serializeKnowledgeEntry),
    unanswered: unanswered.map(serializeUnansweredQuestion),
  };
}

export function knowledgeFromWorkspace(workspace: { knowledge: KnowledgeBase | null }) {
  return workspace.knowledge ? normalizeKnowledge(workspace.knowledge) : emptyKnowledge("custom");
}
