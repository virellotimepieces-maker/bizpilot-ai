import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { runWebsiteSync } from "@/lib/website/run-sync";

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
    if (!source.verifiedAt) {
      throw new BillingError("Verify the website domain before syncing.", "invalid");
    }
    const saved = await runWebsiteSync({ store, source: { ...source, widgetKey: workspace.widgetKey } });
    return NextResponse.json({ source: saved });
  } catch (error) {
    return jsonError(error, "Could not sync the website.");
  }
}
