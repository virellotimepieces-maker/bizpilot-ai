import { NextResponse } from "next/server";
import { BillingService } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { serializeAnalytics } from "@/lib/v2/analytics";

export async function GET() {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const analytics = await new BillingService(store).loadWorkspaceAnalytics(workspace.id);
    return NextResponse.json({ analytics: serializeAnalytics(analytics) });
  } catch (error) {
    return jsonError(error, "Could not load analytics.");
  }
}
