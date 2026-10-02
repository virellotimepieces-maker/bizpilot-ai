import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { serializeLead } from "@/lib/v2/leads";

export async function GET(request: NextRequest) {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const status = request.nextUrl.searchParams.get("status");
    const query = request.nextUrl.searchParams.get("query");
    const leads = await new BillingService(store).listWorkspaceLeads(workspace.id, { status, query });
    return NextResponse.json({ leads: leads.map(serializeLead) });
  } catch (error) {
    return jsonError(error, "Could not load leads.");
  }
}
