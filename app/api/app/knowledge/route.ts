import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { normalizeKnowledge } from "@/lib/empty-knowledge";
import { jsonError } from "@/lib/http";
import type { KnowledgeBase } from "@/lib/types";
import {
  knowledgeFromWorkspace,
  loadKnowledgeEngine,
  requirePaidKnowledgeContext,
} from "@/lib/v2/knowledge-access";

export async function GET() {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const knowledge = knowledgeFromWorkspace(workspace);
    return NextResponse.json(await loadKnowledgeEngine(store, workspace.id, knowledge));
  } catch (error) {
    return jsonError(error, "Could not load knowledge.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const body = (await request.json()) as { knowledge?: KnowledgeBase };
    if (!body.knowledge) throw new BillingError("Knowledge is required.", "invalid");
    const saved = await store.saveKnowledge(workspace.id, normalizeKnowledge(body.knowledge));
    const knowledge = knowledgeFromWorkspace(saved);
    return NextResponse.json(await loadKnowledgeEngine(store, saved.id, knowledge));
  } catch (error) {
    return jsonError(error, "Could not save knowledge.");
  }
}
