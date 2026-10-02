import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { requireUnansweredStatus } from "@/lib/v2/assert";
import { requirePaidKnowledgeContext, serializeUnansweredQuestion } from "@/lib/v2/knowledge-access";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { store, workspace } = await requirePaidKnowledgeContext();
    const body = (await request.json()) as { status?: string };
    if (!body.status) throw new BillingError("Status is required.", "invalid");
    const status = requireUnansweredStatus(body.status);
    const next = await store.updateUnansweredQuestion(id, workspace.id, { status });
    return NextResponse.json({ question: serializeUnansweredQuestion(next) });
  } catch (error) {
    return jsonError(error, "Could not update the unanswered question.");
  }
}
