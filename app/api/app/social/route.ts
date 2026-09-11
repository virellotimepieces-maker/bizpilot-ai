import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { emptyKnowledge, normalizeKnowledge } from "@/lib/empty-knowledge";
import { jsonError } from "@/lib/http";
import { draftSocialFromInbound, isSocialPlatform, isSocialStatus, rebuildSocialDraft } from "@/lib/social";
import type { SocialMessage } from "@/lib/types";

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
    const messages = await store.listSocialMessages(workspace.id, workspace.widgetKey);
    return NextResponse.json({ messages });
  } catch (error) {
    return jsonError(error, "Could not load social drafts.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { store, workspace } = await paidContext();
    const body = (await request.json()) as {
      platform?: string;
      fromName?: string;
      handle?: string;
      body?: string;
      conversationUrl?: string;
    };
    if (!body.platform || !isSocialPlatform(body.platform)) {
      throw new BillingError("Choose Instagram, Facebook, TikTok, or Messenger.", "invalid");
    }
    if (!body.body?.trim()) {
      throw new BillingError("Message is required.", "invalid");
    }
    const kb = normalizeKnowledge(workspace.knowledge ?? emptyKnowledge("custom"));
    const draft = draftSocialFromInbound({
      kb,
      platform: body.platform,
      fromName: body.fromName?.trim() || "Customer",
      handle: body.handle?.trim() || "@customer",
      body: body.body.trim(),
      conversationUrl: body.conversationUrl?.trim() || undefined,
    });
    const message = await store.createSocialMessage({
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      platform: draft.platform,
      fromName: draft.fromName,
      handle: draft.handle,
      body: draft.body,
      conversationUrl: draft.conversationUrl ?? null,
      status: draft.status,
      draftBody: draft.draftBody,
      intent: draft.intent,
      sources: draft.sources,
      operatorNote: draft.operatorNote,
      usedInternalKnowledge: draft.usedInternalKnowledge,
    });
    return NextResponse.json({ message });
  } catch (error) {
    return jsonError(error, "Could not create a social draft.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { store, workspace } = await paidContext();
    const body = (await request.json()) as {
      id?: string;
      draftBody?: string;
      status?: string;
      regenerate?: boolean;
    };
    if (!body.id) throw new BillingError("Message id is required.", "invalid");
    if (body.status !== undefined && !isSocialStatus(body.status)) {
      throw new BillingError("Unknown social status.", "invalid");
    }
    const existing = await store.getSocialMessage(body.id, workspace.id, workspace.widgetKey);
    if (!existing) throw new BillingError("Social draft not found.", "not_found");
    if (body.regenerate) {
      if (existing.status === "posted" || existing.status === "discarded") {
        return NextResponse.json({ message: existing });
      }
      if (!isSocialPlatform(existing.platform) || !isSocialStatus(existing.status)) {
        throw new BillingError("Stored social draft is invalid.", "invalid");
      }
      const kb = normalizeKnowledge(workspace.knowledge ?? emptyKnowledge("custom"));
      const current: SocialMessage = {
        id: existing.id,
        platform: existing.platform,
        fromName: existing.fromName,
        handle: existing.handle,
        body: existing.body,
        receivedAt: existing.createdAt.toISOString(),
        conversationUrl: existing.conversationUrl ?? undefined,
        status: existing.status,
        draftBody: existing.draftBody,
        intent: existing.intent as SocialMessage["intent"],
        sources: existing.sources ?? [],
        operatorNote: existing.operatorNote,
        usedInternalKnowledge: existing.usedInternalKnowledge,
        postedAt: existing.postedAt?.toISOString(),
      };
      const rebuilt = rebuildSocialDraft(current, kb);
      const message = await store.updateSocialMessage(existing.id, workspace.id, workspace.widgetKey, {
        draftBody: rebuilt.draftBody,
        status: rebuilt.status,
        operatorNote: rebuilt.operatorNote,
        intent: rebuilt.intent,
        sources: rebuilt.sources,
        usedInternalKnowledge: rebuilt.usedInternalKnowledge,
      });
      return NextResponse.json({ message });
    }
    const message = await store.updateSocialMessage(body.id, workspace.id, workspace.widgetKey, {
      ...(body.draftBody !== undefined ? { draftBody: body.draftBody } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.status === "posted" ? { postedAt: new Date() } : {}),
    });
    return NextResponse.json({ message });
  } catch (error) {
    return jsonError(error, "Could not update the social draft.");
  }
}
