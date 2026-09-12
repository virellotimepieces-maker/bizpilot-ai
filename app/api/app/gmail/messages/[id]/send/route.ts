import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { gmailGet, gmailPost, requirePaidGmailContext } from "@/lib/gmail/access";
import { ensureGmailReplyDraft } from "@/lib/gmail/drafts";
import { gmailSendPayload } from "@/lib/gmail/mime";
import type { GmailApiMessage } from "@/lib/gmail/parse";
import { summarizeGmailMessage } from "@/lib/gmail/parse";
import { assertSendConfirmed } from "@/lib/gmail/send";
import { jsonError } from "@/lib/http";

function mapClaimError(error: unknown): never {
  if (error instanceof Error) {
    if (error.message === "gmail_already_sent") {
      throw new BillingError("This reply was already sent.", "conflict");
    }
    if (error.message === "gmail_send_in_progress") {
      throw new BillingError("This reply is already being sent.", "conflict");
    }
    if (error.message === "gmail_draft_missing") {
      throw new BillingError("Open this email again before sending.", "not_found");
    }
  }
  throw error;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    if (!id) throw new BillingError("Message id is required.", "invalid");
    const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
    assertSendConfirmed(body.confirm);
    const { store, workspace } = await requirePaidGmailContext();
    const raw = await gmailGet<GmailApiMessage>(
      store,
      workspace,
      `/messages/${encodeURIComponent(id)}?format=full`,
    );
    const summary = summarizeGmailMessage(raw, true);
    await ensureGmailReplyDraft(store, workspace, {
      gmailMessageId: summary.id,
      gmailThreadId: summary.threadId,
      rfcMessageId: summary.rfcMessageId,
      fromName: summary.fromName,
      fromEmail: summary.fromEmail,
      subject: summary.subject,
      body: summary.body,
      receivedAt: new Date(summary.date),
    });
    let claimed;
    try {
      claimed = await store.claimGmailReplySend(workspace.id, summary.id);
    } catch (error) {
      mapClaimError(error);
    }
    if (!claimed.fromEmail) {
      throw new BillingError("This message is missing a sender address, so a reply cannot be sent.", "invalid");
    }
    const connection = await store.getGmailConnection(workspace.id);
    if (!connection) {
      throw new BillingError("Connect Gmail to send this reply.", "not_found");
    }
    try {
      await gmailPost(store, workspace, "/messages/send", gmailSendPayload({
        fromEmail: connection.googleEmail,
        toEmail: claimed.fromEmail,
        subject: claimed.draftSubject,
        body: claimed.draftBody,
        threadId: claimed.gmailThreadId || summary.threadId,
        inReplyTo: claimed.rfcMessageId || summary.rfcMessageId,
      }));
    } catch (error) {
      await store.updateGmailReplyDraft(workspace.id, summary.id, { sendLockAt: null });
      throw error;
    }
    const draft = await store.updateGmailReplyDraft(workspace.id, summary.id, {
      status: "sent",
      sentAt: new Date(),
      sendLockAt: null,
    });
    return NextResponse.json({
      sent: true,
      message: {
        ...summary,
        draft: {
          draftSubject: draft.draftSubject,
          draftBody: draft.draftBody,
          intent: draft.intent,
          sources: draft.sources,
          operatorNote: draft.operatorNote,
          usedInternalKnowledge: draft.usedInternalKnowledge,
          status: draft.status,
          sentAt: draft.sentAt?.toISOString() ?? null,
        },
      },
    });
  } catch (error) {
    return jsonError(error, "Could not send the Gmail reply.");
  }
}
