import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { emptyKnowledge, normalizeKnowledge } from "@/lib/empty-knowledge";
import { jsonError } from "@/lib/http";
import type { KnowledgeBase } from "@/lib/types";

async function paidContext() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspaces = await store.listWorkspacesForUser(userId);
  const workspace = workspaces[0];
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const service = new BillingService(store);
  const paid = await service.requirePaidWorkspace(userId, workspace.id);
  return { store, ...paid };
}

export async function GET() {
  try {
    const { workspace } = await paidContext();
    const knowledge = workspace.knowledge
      ? normalizeKnowledge(workspace.knowledge)
      : emptyKnowledge("custom");
    return NextResponse.json({ knowledge });
  } catch (error) {
    return jsonError(error, "Could not load knowledge.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { store, workspace } = await paidContext();
    const body = (await request.json()) as { knowledge?: KnowledgeBase };
    if (!body.knowledge) throw new BillingError("Knowledge is required.", "invalid");
    const saved = await store.saveKnowledge(workspace.id, normalizeKnowledge(body.knowledge));
    return NextResponse.json({ knowledge: saved.knowledge });
  } catch (error) {
    return jsonError(error, "Could not save knowledge.");
  }
}
