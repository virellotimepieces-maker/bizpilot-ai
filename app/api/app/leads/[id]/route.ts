import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { parseLeadPatch, serializeLead } from "@/lib/v2/leads";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { store, workspace } = await requirePaidKnowledgeContext();
    const patch = parseLeadPatch(await request.json());
    const lead = await new BillingService(store).updateWorkspaceLead(workspace.id, id, patch);
    return NextResponse.json({ lead: serializeLead(lead) });
  } catch (error) {
    return jsonError(error, "Could not update the lead.");
  }
}
