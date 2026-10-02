import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { requireKnowledgeKind } from "@/lib/v2/assert";
import { requirePaidKnowledgeContext, serializeKnowledgeEntry } from "@/lib/v2/knowledge-access";

export async function POST(request: NextRequest) {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const body = (await request.json()) as {
      kind?: string;
      title?: string;
      content?: string;
    };
    const title = body.title?.trim() ?? "";
    const content = body.content?.trim() ?? "";
    if (!title || !content) throw new BillingError("Title and content are required.", "invalid");
    const row = await store.createKnowledgeEntry(workspace.id, {
      kind: requireKnowledgeKind(body.kind ?? "manual"),
      title,
      content,
      enabled: true,
      sourceType: "manual",
      sourceLabel: "Owner entry",
      sourceRef: "",
    });
    return NextResponse.json({ entry: serializeKnowledgeEntry(row) });
  } catch (error) {
    return jsonError(error, "Could not add the knowledge fact.");
  }
}
