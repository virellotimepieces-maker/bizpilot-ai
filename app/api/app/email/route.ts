import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { emptyKnowledge, normalizeKnowledge } from "@/lib/empty-knowledge";
import { draftEmailFromInbound, isEmailStatus, rebuildEmailDraft } from "@/lib/email-draft";
import { jsonError } from "@/lib/http";
import type { EmailMessage } from "@/lib/types";

async function paidContext() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspaces = await store.listWorkspacesForUser(userId);
  const workspace = workspaces[0];
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const paid = await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
  return { store, ...paid };
}

export async function GET() {
  try {
    const { store, workspace } = await paidContext();
    const messages = await store.listEmailDrafts(workspace.id, workspace.widgetKey);
    return NextResponse.json({ messages });
  } catch (error) {
    return jsonError(error, "Could not load email drafts.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { store, workspace } = await paidContext();
    const body = (await request.json()) as {
      fromName?: string;
      fromEmail?: string;
      subject?: string;
      body?: string;
    };
    if (!body.body?.trim()) {
      throw new BillingError("Message is required.", "invalid");
    }
    if (!body.fromEmail?.trim()) {
      throw new BillingError("Sender email is required.", "invalid");
    }
    const kb = normalizeKnowledge(workspace.knowledge ?? emptyKnowledge("custom"));
    const draft = draftEmailFromInbound({
      kb,
      fromName: body.fromName?.trim() || body.fromEmail.trim(),
      fromEmail: body.fromEmail.trim(),
      subject: body.subject?.trim() || "(no subject)",
      body: body.body.trim(),
    });
    const message = await store.createEmailDraft({
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      fromName: draft.fromName,
      fromEmail: draft.fromEmail,
      subject: draft.subject,
      body: draft.body,
      status: draft.status,
      draftSubject: draft.draftSubject,
      draftBody: draft.draftBody,
      intent: draft.intent,
      sources: draft.sources,
      operatorNote: draft.operatorNote,
      usedInternalKnowledge: draft.usedInternalKnowledge,
    });
    return NextResponse.json({ message });
  } catch (error) {
    return jsonError(error, "Could not create an email draft.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { store, workspace } = await paidContext();
    const body = (await request.json()) as {
      id?: string;
      draftBody?: string;
      draftSubject?: string;
      status?: string;
      regenerate?: boolean;
    };
    if (!body.id) throw new BillingError("Message id is required.", "invalid");
    if (body.status !== undefined && !isEmailStatus(body.status)) {
      throw new BillingError("Unknown email status.", "invalid");
    }
    const existing = await store.getEmailDraft(body.id, workspace.id, workspace.widgetKey);
    if (!existing) throw new BillingError("Email draft not found.", "not_found");
    if (body.regenerate) {
      if (existing.status === "sent" || existing.status === "discarded") {
        return NextResponse.json({ message: existing });
      }
      if (!isEmailStatus(existing.status)) {
        throw new BillingError("Stored email draft is invalid.", "invalid");
      }
      const kb = normalizeKnowledge(workspace.knowledge ?? emptyKnowledge("custom"));
      const current: EmailMessage = {
        id: existing.id,
        fromName: existing.fromName,
        fromEmail: existing.fromEmail,
        subject: existing.subject,
        body: existing.body,
        receivedAt: existing.createdAt.toISOString(),
        status: existing.status,
        draftSubject: existing.draftSubject,
        draftBody: existing.draftBody,
        intent: existing.intent as EmailMessage["intent"],
        sources: existing.sources ?? [],
        operatorNote: existing.operatorNote,
        usedInternalKnowledge: existing.usedInternalKnowledge,
        sentAt: existing.sentAt?.toISOString(),
      };
      const rebuilt = rebuildEmailDraft(current, kb);
      const message = await store.updateEmailDraft(existing.id, workspace.id, workspace.widgetKey, {
        draftBody: rebuilt.draftBody,
        draftSubject: rebuilt.draftSubject,
        status: rebuilt.status,
        operatorNote: rebuilt.operatorNote,
        intent: rebuilt.intent,
        sources: rebuilt.sources,
        usedInternalKnowledge: rebuilt.usedInternalKnowledge,
      });
      return NextResponse.json({ message });
    }
    const message = await store.updateEmailDraft(body.id, workspace.id, workspace.widgetKey, {
      ...(body.draftBody !== undefined ? { draftBody: body.draftBody } : {}),
      ...(body.draftSubject !== undefined ? { draftSubject: body.draftSubject } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.status === "sent" ? { sentAt: new Date() } : {}),
    });
    return NextResponse.json({ message });
  } catch (error) {
    return jsonError(error, "Could not update the email draft.");
  }
}
