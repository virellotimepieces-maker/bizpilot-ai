import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { gmailGet, requirePaidGmailContext } from "@/lib/gmail/access";
import { ensureGmailReplyDraft } from "@/lib/gmail/drafts";
import type { GmailApiMessage } from "@/lib/gmail/parse";
import { summarizeGmailMessage } from "@/lib/gmail/parse";
import { jsonError } from "@/lib/http";

function publicDraft(draft: {
  draftSubject: string;
  draftBody: string;
  intent: string;
  sources: unknown;
  operatorNote: string;
  usedInternalKnowledge: boolean;
  status: string;
  sentAt: Date | null;
}) {
  return {
    draftSubject: draft.draftSubject,
    draftBody: draft.draftBody,
    intent: draft.intent,
    sources: draft.sources,
    operatorNote: draft.operatorNote,
    usedInternalKnowledge: draft.usedInternalKnowledge,
    status: draft.status,
    sentAt: draft.sentAt?.toISOString() ?? null,
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) throw new BillingError("Message id is required.", "invalid");
    const { store, workspace } = await requirePaidGmailContext();
    const raw = await gmailGet<GmailApiMessage>(
      store,
      workspace,
      `/messages/${encodeURIComponent(id)}?format=full`,
    );
    const summary = summarizeGmailMessage(raw, true);
    const draft = await ensureGmailReplyDraft(store, workspace, {
      gmailMessageId: summary.id,
      gmailThreadId: summary.threadId,
      rfcMessageId: summary.rfcMessageId,
      fromName: summary.fromName,
      fromEmail: summary.fromEmail,
      subject: summary.subject,
      body: summary.body,
      receivedAt: new Date(summary.date),
    });
    return NextResponse.json({
      message: {
        ...summary,
        draft: publicDraft(draft),
      },
    });
  } catch (error) {
    return jsonError(error, "Could not load this Gmail message.");
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) throw new BillingError("Message id is required.", "invalid");
    const { store, workspace } = await requirePaidGmailContext();
    const body = (await request.json()) as {
      draftBody?: string;
      draftSubject?: string;
      regenerate?: boolean;
    };
    const raw = await gmailGet<GmailApiMessage>(
      store,
      workspace,
      `/messages/${encodeURIComponent(id)}?format=full`,
    );
    const summary = summarizeGmailMessage(raw, true);
    if (body.regenerate) {
      const draft = await ensureGmailReplyDraft(store, workspace, {
        gmailMessageId: summary.id,
        gmailThreadId: summary.threadId,
        rfcMessageId: summary.rfcMessageId,
        fromName: summary.fromName,
        fromEmail: summary.fromEmail,
        subject: summary.subject,
        body: summary.body,
        receivedAt: new Date(summary.date),
        regenerate: true,
      });
      return NextResponse.json({
        message: { ...summary, draft: publicDraft(draft) },
      });
    }
    const existing = await store.getGmailReplyDraft(workspace.id, summary.id);
    if (!existing) {
      throw new BillingError("Open this email again before editing the reply.", "not_found");
    }
    if (existing.status === "sent") {
      throw new BillingError("This reply was already sent.", "conflict");
    }
    const draft = await store.updateGmailReplyDraft(workspace.id, summary.id, {
      ...(body.draftBody !== undefined ? { draftBody: body.draftBody } : {}),
      ...(body.draftSubject !== undefined ? { draftSubject: body.draftSubject } : {}),
    });
    return NextResponse.json({
      message: { ...summary, draft: publicDraft(draft) },
    });
  } catch (error) {
    return jsonError(error, "Could not update the suggested reply.");
  }
}
