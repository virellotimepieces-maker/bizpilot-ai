import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { disconnectSocialAccount } from "@/lib/social/connect";
import { requireSocialWorkspace } from "@/lib/social/context";

export async function POST(_request: Request, context: { params: Promise<{ platform: string }> }) {
  try {
    const { store, workspace } = await requireSocialWorkspace();
    const { platform } = await context.params;
    const removed = await disconnectSocialAccount({ store, workspaceId: workspace.id, platform });
    if (!removed) return NextResponse.json({ disconnected: false });
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    return jsonError(error, "Could not disconnect the social account.");
  }
}
