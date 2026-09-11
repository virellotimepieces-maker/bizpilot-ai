import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { verifyWebsiteOwnership } from "@/lib/website/sync";

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) throw new BillingError("Sign in required.", "unauthorized");
    const store = getBillingStore();
    const workspaces = await store.listWorkspacesForUser(userId);
    const workspace = workspaces[0];
    if (!workspace) throw new BillingError("No workspace found.", "not_found");
    await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
    const source = await store.getWebsiteSource(workspace.id);
    if (!source) throw new BillingError("Save a website domain first.", "invalid");
    const result = await verifyWebsiteOwnership({
      domain: source.domain,
      widgetKey: workspace.widgetKey,
      token: source.verifyToken,
    });
    if (!result.verified) {
      throw new BillingError(
        "Could not verify that domain. Confirm the BizPilot snippet is on the live homepage, or publish the verification file, then try again.",
        "invalid",
      );
    }
    const saved = await store.saveWebsiteSource({
      ...source,
      widgetKey: workspace.widgetKey,
      verifiedAt: new Date(),
    });
    return NextResponse.json({ source: saved, method: result.method });
  } catch (error) {
    return jsonError(error, "Could not verify the website domain.");
  }
}
