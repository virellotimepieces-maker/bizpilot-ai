import type { BillingStore } from "@/lib/billing/store";
import type { GmailReplyDraftRecord, WorkspaceRecord } from "@/lib/billing/types";
import { emptyKnowledge, normalizeKnowledge } from "@/lib/empty-knowledge";
import { draftEmailFromInbound, rebuildEmailDraft } from "@/lib/email-draft";
import type { EmailMessage } from "@/lib/types";
import { replySubjectFor } from "./send";

export function draftFromGmailMessage(input: {
  workspace: WorkspaceRecord;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
}) {
  const kb = normalizeKnowledge(input.workspace.knowledge ?? emptyKnowledge("custom"));
  const draft = draftEmailFromInbound({
    kb,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    subject: input.subject,
    body: input.body,
  });
  return {
    ...draft,
    draftSubject: replySubjectFor(input.subject, input.body),
  };
}

export async function ensureGmailReplyDraft(
  store: BillingStore,
  workspace: WorkspaceRecord,
  input: {
    gmailMessageId: string;
    gmailThreadId: string;
    rfcMessageId?: string | null;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt?: Date | null;
    regenerate?: boolean;
  },
): Promise<GmailReplyDraftRecord> {
  const existing = await store.getGmailReplyDraft(workspace.id, input.gmailMessageId);
  if (existing?.status === "sent" && !input.regenerate) {
    return existing;
  }
  if (existing && !input.regenerate) {
    return existing;
  }
  if (existing && input.regenerate) {
    const kb = normalizeKnowledge(workspace.knowledge ?? emptyKnowledge("custom"));
    const current: EmailMessage = {
      id: existing.id,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      subject: input.subject,
      body: input.body,
      receivedAt: input.receivedAt?.toISOString() ?? existing.receivedAt?.toISOString() ?? "",
      status: existing.status === "sent" ? "sent" : "draft_ready",
      draftSubject: existing.draftSubject,
      draftBody: existing.draftBody,
      intent: existing.intent as EmailMessage["intent"],
      sources: existing.sources ?? [],
      operatorNote: existing.operatorNote,
      usedInternalKnowledge: existing.usedInternalKnowledge,
      sentAt: existing.sentAt?.toISOString(),
    };
    const rebuilt = rebuildEmailDraft(current, kb);
    return store.updateGmailReplyDraft(workspace.id, input.gmailMessageId, {
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      subject: input.subject,
      body: input.body,
      receivedAt: input.receivedAt ?? existing.receivedAt,
      gmailThreadId: input.gmailThreadId,
      rfcMessageId: input.rfcMessageId ?? existing.rfcMessageId,
      draftSubject: rebuilt.draftSubject,
      draftBody: rebuilt.draftBody,
      intent: rebuilt.intent,
      sources: rebuilt.sources,
      operatorNote: rebuilt.operatorNote,
      usedInternalKnowledge: rebuilt.usedInternalKnowledge,
      status: existing.status === "sent" ? "sent" : "draft",
    });
  }
  const generated = draftFromGmailMessage({
    workspace,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    subject: input.subject,
    body: input.body,
  });
  return store.upsertGmailReplyDraft({
    workspaceId: workspace.id,
    gmailMessageId: input.gmailMessageId,
    gmailThreadId: input.gmailThreadId,
    rfcMessageId: input.rfcMessageId ?? null,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    subject: input.subject,
    body: input.body,
    receivedAt: input.receivedAt ?? null,
    draftSubject: generated.draftSubject,
    draftBody: generated.draftBody,
    intent: generated.intent,
    sources: generated.sources,
    operatorNote: generated.operatorNote,
    usedInternalKnowledge: generated.usedInternalKnowledge,
    status: "draft",
  });
}
