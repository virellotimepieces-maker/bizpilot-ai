import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService, hasPaidDashboardAccess } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { BIZPILOT_PRO } from "@/lib/plan";
import { missingPaidEnv } from "@/lib/env";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) throw new BillingError("Sign in required.", "unauthorized");
    const store = getBillingStore();
    const user = await store.findUserById(userId);
    if (!user) throw new BillingError("Sign in required.", "unauthorized");
    const workspaces = await store.listWorkspacesForUser(userId);
    const workspace = workspaces[0] ?? null;
    const subscription = workspace
      ? await store.getSubscriptionByWorkspace(workspace.id)
      : null;
    const service = new BillingService(store);
    let usage = null;
    if (workspace && hasPaidDashboardAccess(subscription)) {
      usage = service.usageSnapshot((await service.peekUsage(workspace.id)).period);
    }
    const notifications = workspace
      ? await store.listNotifications(userId, workspace.id)
      : [];
    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      workspace,
      subscription,
      usage,
      notifications,
      plan: BIZPILOT_PRO,
      paidAccess: hasPaidDashboardAccess(subscription),
      missingEnv: missingPaidEnv(),
      appUrl: process.env.APP_URL?.replace(/\/$/, "") ?? "",
    });
  } catch (error) {
    return jsonError(error, "Could not load the account.");
  }
}
