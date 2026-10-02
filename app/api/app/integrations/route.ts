import { NextResponse } from "next/server";
import { BillingService } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { serializeWorkspaceIntegrations } from "@/lib/v2/integrations";

export async function GET() {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const integrations = await new BillingService(store).listWorkspaceIntegrations(workspace.id);
    return NextResponse.json({ integrations: serializeWorkspaceIntegrations(integrations) });
  } catch (error) {
    return jsonError(error, "Could not load integrations.");
  }
}
