import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { socialWorkflowStatus } from "@/lib/social-content";
import { readSocialDraftMeta } from "@/lib/social";
import { requireSocialWorkspace } from "@/lib/social/context";
import { publishApprovedSocialDraft } from "@/lib/social/publish";

export async function POST(request: NextRequest) {
  try {
    const { store, workspace, userId } = await requireSocialWorkspace();
    const body = (await request.json()) as { id?: string; confirm?: boolean };
    if (!body.id) {
      return NextResponse.json({ error: "Message id is required.", code: "invalid" }, { status: 400 });
    }
    const message = await publishApprovedSocialDraft({
      store,
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      userId,
      messageId: body.id,
      confirm: body.confirm === true,
      appUrl: process.env.APP_URL?.trim() || "",
    });
    const meta = readSocialDraftMeta(message.handle);
    return NextResponse.json({
      message: {
        id: message.id,
        platform: message.platform,
        status: message.status,
        workflow: socialWorkflowStatus(message.status),
        draftBody: message.draftBody,
        destinationName: message.destinationName,
        destinationId: message.destinationId,
        platformPostId: message.platformPostId,
        publishError: message.publishError,
        postedAt: message.postedAt,
        createdAt: message.createdAt,
        language: meta.language || "",
        mediaAttached: Boolean(message.mediaAssetId),
      },
    });
  } catch (error) {
    return jsonError(error, "Could not publish the social post.");
  }
}
