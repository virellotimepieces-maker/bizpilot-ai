import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) throw new BillingError("Sign in required.", "unauthorized");
    const store = getBillingStore();
    const workspaces = await store.listWorkspacesForUser(userId);
    const workspace = workspaces[0];
    if (!workspace) throw new BillingError("No workspace found.", "not_found");
    await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
    const next = await store.updateWorkspace(workspace.id, {
      widgetKey: `bpw_${crypto.randomUUID().replaceAll("-", "")}`,
    });
    return NextResponse.json({ widgetKey: next.widgetKey });
  } catch (error) {
    return jsonError(error, "Could not rotate the widget key.");
  }
}
