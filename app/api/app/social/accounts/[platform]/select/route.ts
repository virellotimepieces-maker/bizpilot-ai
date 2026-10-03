import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { selectSocialDestination } from "@/lib/social/connect";
import { requireSocialWorkspace } from "@/lib/social/context";
import { publicSocialAccount } from "@/lib/social/public";
import { isSocialOAuthPlatform } from "@/lib/social/platforms";
import { BillingError } from "@/lib/billing/types";

export async function POST(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  try {
    const { store, workspace } = await requireSocialWorkspace();
    const { platform } = await context.params;
    const body = (await request.json()) as { destinationId?: string };
    if (!body.destinationId) throw new BillingError("Choose a destination.", "invalid");
    await selectSocialDestination({
      store,
      workspaceId: workspace.id,
      platform,
      destinationId: body.destinationId,
    });
    const row = await store.getSocialAccount(workspace.id, platform);
    if (!isSocialOAuthPlatform(platform)) throw new BillingError("Choose a supported social platform.", "invalid");
    return NextResponse.json({ account: publicSocialAccount(platform, row) });
  } catch (error) {
    return jsonError(error, "Could not save the social destination.");
  }
}
