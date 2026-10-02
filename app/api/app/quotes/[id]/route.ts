import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { parseQuotePatch, serializeQuoteRequest } from "@/lib/v2/quotes";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { store, workspace } = await requirePaidKnowledgeContext();
    const patch = parseQuotePatch(await request.json());
    const quote = await new BillingService(store).updateWorkspaceQuoteRequest(workspace.id, id, patch);
    return NextResponse.json({ quote: serializeQuoteRequest(quote) });
  } catch (error) {
    return jsonError(error, "Could not update the quote request.");
  }
}
