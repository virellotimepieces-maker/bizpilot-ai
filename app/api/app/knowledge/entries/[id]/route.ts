import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { requireKnowledgeKind } from "@/lib/v2/assert";
import { requirePaidKnowledgeContext, serializeKnowledgeEntry } from "@/lib/v2/knowledge-access";
import { isExtraKnowledgeEntry, isProjectedKnowledgeEntry } from "@/lib/v2/entry-scope";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { store, workspace } = await requirePaidKnowledgeContext();
    const current = await store.getKnowledgeEntry(id, workspace.id);
    if (!current) throw new BillingError("Knowledge fact not found.", "not_found");
    const body = (await request.json()) as {
      enabled?: boolean;
      title?: string;
      content?: string;
      kind?: string;
    };
    if (isProjectedKnowledgeEntry(current)) {
      if (body.title !== undefined || body.content !== undefined || body.kind !== undefined) {
        throw new BillingError("Edit projected facts in the knowledge form, then save.", "invalid");
      }
      const next = await store.updateKnowledgeEntry(id, workspace.id, {
        enabled: body.enabled,
      });
      return NextResponse.json({ entry: serializeKnowledgeEntry(next) });
    }
    if (!isExtraKnowledgeEntry(current)) {
      throw new BillingError("This fact cannot be edited here.", "invalid");
    }
    const next = await store.updateKnowledgeEntry(id, workspace.id, {
      enabled: body.enabled,
      title: body.title,
      content: body.content,
      kind: body.kind ? requireKnowledgeKind(body.kind) : undefined,
    });
    return NextResponse.json({ entry: serializeKnowledgeEntry(next) });
  } catch (error) {
    return jsonError(error, "Could not update the knowledge fact.");
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const { store, workspace } = await requirePaidKnowledgeContext();
    const current = await store.getKnowledgeEntry(id, workspace.id);
    if (!current) throw new BillingError("Knowledge fact not found.", "not_found");
    if (!isExtraKnowledgeEntry(current)) {
      throw new BillingError("Remove projected facts from the knowledge form, then save.", "invalid");
    }
    await store.deleteKnowledgeEntry(id, workspace.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error, "Could not delete the knowledge fact.");
  }
}
