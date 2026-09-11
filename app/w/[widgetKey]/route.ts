import { buildWidgetEmbedScript } from "@/lib/widget-embed-script";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ widgetKey: string }> },
) {
  const { widgetKey: raw } = await context.params;
  const widgetKey = raw.replace(/\.js$/, "");
  const origin = new URL(request.url).origin;
  const script = buildWidgetEmbedScript(origin, widgetKey);
  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
