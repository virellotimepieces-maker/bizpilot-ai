import { NextRequest, NextResponse } from "next/server";
import { BillingService } from "@/lib/billing/service";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { serializeQuoteRequest } from "@/lib/v2/quotes";

export async function GET(request: NextRequest) {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const status = request.nextUrl.searchParams.get("status");
    const query = request.nextUrl.searchParams.get("query");
    const quotes = await new BillingService(store).listWorkspaceQuoteRequests(workspace.id, {
      status,
      query,
    });
    return NextResponse.json({ quotes: quotes.map(serializeQuoteRequest) });
  } catch (error) {
    return jsonError(error, "Could not load quote requests.");
  }
}
