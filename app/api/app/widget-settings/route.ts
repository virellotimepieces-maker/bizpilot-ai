import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";
import { parseWidgetSettingsInput, serializeWidgetSettings } from "@/lib/v2/widget-settings";

export async function GET() {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const settings = await store.upsertWidgetSettings(workspace.id, {});
    return NextResponse.json({ settings: serializeWidgetSettings(settings) });
  } catch (error) {
    return jsonError(error, "Could not load widget appearance.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const body = (await request.json()) as unknown;
    const patch = parseWidgetSettingsInput(body);
    if (patch.leadCaptureEnabled === false) patch.collectPhone = false;
    const settings = await store.upsertWidgetSettings(workspace.id, patch);
    return NextResponse.json({ settings: serializeWidgetSettings(settings) });
  } catch (error) {
    return jsonError(error, "Could not save widget appearance.");
  }
}
