import { NextRequest, NextResponse } from "next/server";
import type { BillingStore } from "@/lib/billing/store";
import { BillingError } from "@/lib/billing/types";
import type { SocialMessageRecord } from "@/lib/billing/types";
import { emptyKnowledge, normalizeKnowledge } from "@/lib/empty-knowledge";
import { jsonError } from "@/lib/http";
import { publishedKnowledgeBase } from "@/lib/v2/published-knowledge";
import {
  draftSocialFromInboundAi,
  isSocialGoal,
  isSocialHashtagMode,
  isSocialMode,
  isSocialPlatform,
  isSocialStatus,
  isSocialTone,
  readSocialDraftMeta,
  rebuildSocialDraftAi,
} from "@/lib/social";
import {
  clientMaySetSocialStatus,
  contentTopic,
  isSocialContentGoal,
  isSocialContentLanguage,
  resolveSocialContentLanguage,
  socialLanguageInstruction,
  socialWorkflowStatus,
  verifiedSocialFacts,
} from "@/lib/social-content";
import { requireSocialWorkspace, socialReadContext } from "@/lib/social/context";
import { evaluateSocialPublish } from "@/lib/social/publish-policy";
import { publicSocialAccount, publicSocialAccounts } from "@/lib/social/public";
import { isSocialOAuthPlatform } from "@/lib/social/platforms";
import type { SocialMessage } from "@/lib/types";

function toClient(
  row: SocialMessageRecord,
  input: { subscriptionActive: boolean; accounts: ReturnType<typeof publicSocialAccounts> },
) {
  const meta = readSocialDraftMeta(row.handle);
  const account = isSocialOAuthPlatform(row.platform)
    ? input.accounts.find((item) => item.platform === row.platform) ?? publicSocialAccount(row.platform, null)
    : null;
  const decision = evaluateSocialPublish({
    status: row.status,
    subscriptionActive: input.subscriptionActive,
    hasMedia: Boolean(row.mediaAssetId),
    account,
  });
  return {
    id: row.id,
    platform: row.platform,
    fromName: row.fromName,
    handle: row.handle,
    body: row.body,
    conversationUrl: row.conversationUrl,
    status: row.status,
    workflow: socialWorkflowStatus(row.status),
    language: meta.language || "",
    goal: meta.goal || "",
    draftBody: row.draftBody,
    intent: row.intent,
    sources: row.sources,
    operatorNote: row.operatorNote,
    usedInternalKnowledge: row.usedInternalKnowledge,
    createdAt: row.createdAt,
    postedAt: row.postedAt,
    destinationName: row.destinationName,
    publishError: row.publishError,
    mediaAttached: Boolean(row.mediaAssetId),
    publishAvailable: decision.ok,
    publishReason: decision.reason,
  };
}

async function workspaceFacts(
  store: BillingStore,
  workspaceId: string,
  widgetKey: string,
  knowledge: ReturnType<typeof normalizeKnowledge>,
  instruction: string,
  goal: NonNullable<Parameters<typeof verifiedSocialFacts>[0]["goal"]>,
) {
  const entries = await store.listKnowledgeEntries(workspaceId);
  const published = publishedKnowledgeBase(knowledge, entries) ?? knowledge;
  const pages = await store.listWebsitePages(workspaceId, widgetKey);
  const products = (await store.listShopifyProducts(workspaceId)).filter((row) => row.workspaceId === workspaceId);
  return {
    knowledge: published,
    extraFacts: verifiedSocialFacts({
      knowledge: published,
      instruction,
      goal,
      workspaceId,
      pages,
      products,
    }),
  };
}

export async function GET() {
  try {
    const { store, workspace, subscriptionActive } = await socialReadContext();
    const accounts = publicSocialAccounts(await store.listSocialAccounts(workspace.id));
    const messages = await store.listSocialMessages(workspace.id, workspace.widgetKey);
    const view = { subscriptionActive, accounts };
    return NextResponse.json({
      messages: messages.map((row) => toClient(row, view)),
      accounts,
      publishing: {
        connected: accounts.some((account) => account.connection === "connected"),
        subscriptionActive,
      },
    });
  } catch (error) {
    return jsonError(error, "Could not load social drafts.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { store, workspace, userId, service } = await requireSocialWorkspace();
    const body = (await request.json()) as {
      mode?: string;
      platform?: string;
      fromName?: string;
      handle?: string;
      body?: string;
      instruction?: string;
      conversationUrl?: string;
      tone?: string;
      goal?: string;
      hashtags?: string;
      customHashtags?: string;
      cta?: string;
      link?: string;
      language?: string;
      otherLanguage?: string;
    };
    const platform = body.platform ?? "";
    if (!isSocialPlatform(platform)) {
      throw new BillingError("Choose Facebook, Instagram, LinkedIn, Threads, X, or Pinterest.", "invalid");
    }
    const mode = body.mode && isSocialMode(body.mode) ? body.mode : "post";
    const instruction = (body.instruction ?? body.body ?? "").trim();
    const goal =
      body.goal && isSocialGoal(body.goal) ? body.goal : mode === "post" ? "custom" : undefined;
    if (mode === "post" && goal && !isSocialContentGoal(goal) && !isSocialGoal(goal)) {
      throw new BillingError("Choose a valid content goal.", "invalid");
    }
    if (mode === "reply" && !instruction) {
      throw new BillingError("Received message is required.", "invalid");
    }
    if (body.tone !== undefined && body.tone !== "" && !isSocialTone(body.tone)) {
      throw new BillingError("Choose a valid tone.", "invalid");
    }
    if (body.hashtags !== undefined && body.hashtags !== "" && !isSocialHashtagMode(body.hashtags)) {
      throw new BillingError("Choose None, Suggested, or Custom hashtags.", "invalid");
    }
    if (body.language && body.language !== "" && !isSocialContentLanguage(body.language) && mode === "post") {
      throw new BillingError("Choose a supported language.", "invalid");
    }
    const baseKnowledge = normalizeKnowledge(workspace.knowledge ?? emptyKnowledge("custom"));
    const contentGoal = goal && isSocialGoal(goal) ? goal : "custom";
    const languageCode =
      mode === "post"
        ? resolveSocialContentLanguage({
            choice: body.language,
            instruction,
            other: body.otherLanguage,
          })
        : body.language?.trim() || undefined;
    const { knowledge, extraFacts } = await workspaceFacts(
      store,
      workspace.id,
      workspace.widgetKey,
      baseKnowledge,
      instruction,
      contentGoal,
    );
    const topic = mode === "post" ? contentTopic(contentGoal, instruction) : instruction;
    const counted = await service.accountSocialGeneration(workspace.id, userId, () =>
      draftSocialFromInboundAi({
        kb: knowledge,
        platform,
        fromName: body.fromName?.trim() || (mode === "post" ? "New post" : undefined),
        handle: body.handle?.trim() || undefined,
        body: topic,
        conversationUrl: body.conversationUrl?.trim() || body.link?.trim() || undefined,
        mode,
        tone: body.tone && isSocialTone(body.tone) ? body.tone : "friendly",
        goal: contentGoal,
        hashtags: mode === "post" ? (body.hashtags && isSocialHashtagMode(body.hashtags) ? body.hashtags : "suggested") : "none",
        customHashtags: body.customHashtags?.trim() || undefined,
        cta: body.cta?.trim() || undefined,
        link: body.link?.trim() || undefined,
        language: languageCode ? socialLanguageInstruction(languageCode) : undefined,
        extraFacts,
        workspaceId: workspace.id,
      }),
    );
    const draft = counted.value;
    const message = await store.createSocialMessage({
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      platform: draft.platform,
      fromName: draft.fromName,
      handle: draft.handle,
      body: instruction,
      conversationUrl: draft.conversationUrl ?? null,
      status: mode === "post" ? "draft" : draft.status,
      draftBody: draft.draftBody,
      intent: draft.intent,
      sources: draft.sources,
      operatorNote: draft.operatorNote,
      usedInternalKnowledge: draft.usedInternalKnowledge,
    });
    const accounts = publicSocialAccounts(await store.listSocialAccounts(workspace.id));
    return NextResponse.json({
      message: toClient(message, { subscriptionActive: true, accounts }),
      usage: counted.usage,
    });
  } catch (error) {
    return jsonError(error, "Could not create a social draft.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { store, workspace, userId, service } = await requireSocialWorkspace();
    const body = (await request.json()) as {
      id?: string;
      draftBody?: string;
      status?: string;
      regenerate?: boolean;
      mediaAssetId?: string;
    };
    if (!body.id) throw new BillingError("Message id is required.", "invalid");
    if (
      body.status === "published" ||
      body.status === "posted" ||
      body.status === "failed" ||
      body.status === "publishing"
    ) {
      throw new BillingError("Approve the draft before publishing. Nothing is posted automatically.", "invalid");
    }
    if (body.status !== undefined && !clientMaySetSocialStatus(body.status)) {
      throw new BillingError("Choose Draft or Approved.", "invalid");
    }
    const existing = await store.getSocialMessage(body.id, workspace.id, workspace.widgetKey);
    if (!existing) throw new BillingError("Social draft not found.", "not_found");
    if (body.regenerate) {
      if (
        existing.status === "published" ||
        existing.status === "publishing" ||
        existing.status === "posted" ||
        existing.status === "discarded"
      ) {
        const accounts = publicSocialAccounts(await store.listSocialAccounts(workspace.id));
        return NextResponse.json({ message: toClient(existing, { subscriptionActive: true, accounts }) });
      }
      if (!isSocialPlatform(existing.platform) || !isSocialStatus(existing.status)) {
        throw new BillingError("Stored social draft is invalid.", "invalid");
      }
      const baseKnowledge = normalizeKnowledge(workspace.knowledge ?? emptyKnowledge("custom"));
      const meta = readSocialDraftMeta(existing.handle);
      const contentGoal = meta.goal && isSocialGoal(meta.goal) ? meta.goal : "custom";
      const { knowledge, extraFacts } = await workspaceFacts(
        store,
        workspace.id,
        workspace.widgetKey,
        baseKnowledge,
        existing.body,
        contentGoal,
      );
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
      };
      const counted = await service.accountSocialGeneration(workspace.id, userId, () =>
        rebuildSocialDraftAi(current, knowledge, { workspaceId: workspace.id, extraFacts }),
      );
      const rebuilt = counted.value;
      const message = await store.updateSocialMessage(existing.id, workspace.id, workspace.widgetKey, {
        draftBody: rebuilt.draftBody,
        status: existing.status === "approved" ? "approved" : "draft",
        operatorNote: rebuilt.operatorNote,
        intent: rebuilt.intent,
        sources: rebuilt.sources,
        usedInternalKnowledge: rebuilt.usedInternalKnowledge,
      });
      const accounts = publicSocialAccounts(await store.listSocialAccounts(workspace.id));
      return NextResponse.json({
        message: toClient(message, { subscriptionActive: true, accounts }),
        usage: counted.usage,
      });
    }
    if (existing.status === "publishing" || existing.status === "published") {
      throw new BillingError("This post can no longer be edited.", "conflict");
    }
    if (body.mediaAssetId !== undefined && body.mediaAssetId !== "") {
      const asset = await store.getSocialMediaAsset(body.mediaAssetId, workspace.id);
      if (!asset) throw new BillingError("The attached image is not in this workspace.", "invalid");
    }
    const message = await store.updateSocialMessage(body.id, workspace.id, workspace.widgetKey, {
      ...(body.draftBody !== undefined ? { draftBody: body.draftBody } : {}),
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.mediaAssetId !== undefined ? { mediaAssetId: body.mediaAssetId } : {}),
    });
    const accounts = publicSocialAccounts(await store.listSocialAccounts(workspace.id));
    return NextResponse.json({ message: toClient(message, { subscriptionActive: true, accounts }) });
  } catch (error) {
    return jsonError(error, "Could not update the social draft.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { store, workspace } = await socialReadContext();
    const body = (await request.json()) as { id?: string };
    if (!body.id) throw new BillingError("Message id is required.", "invalid");
    const existing = await store.getSocialMessage(body.id, workspace.id, workspace.widgetKey);
    if (!existing) throw new BillingError("Social draft not found.", "not_found");
    if (existing.status === "publishing") {
      throw new BillingError("This post is already publishing.", "conflict");
    }
    const removed = await store.deleteSocialMessage(body.id, workspace.id, workspace.widgetKey);
    if (!removed) throw new BillingError("Social draft not found.", "not_found");
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return jsonError(error, "Could not delete the social draft.");
  }
}
