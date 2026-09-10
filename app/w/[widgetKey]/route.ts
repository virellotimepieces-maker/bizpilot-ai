import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ widgetKey: string }> },
) {
  const { widgetKey: raw } = await context.params;
  const widgetKey = raw.replace(/\.js$/, "");
  const origin = new URL(request.url).origin;
  const script = `(() => {
  const KEY = ${JSON.stringify(widgetKey)};
  const ORIGIN = ${JSON.stringify(origin)};
  if (document.getElementById("bizpilot-widget")) return;
  const frame = document.createElement("iframe");
  frame.id = "bizpilot-widget";
  frame.title = "BizPilot chat";
  frame.src = ORIGIN + "/embed/" + encodeURIComponent(KEY);
  frame.style.cssText = "position:fixed;right:16px;bottom:16px;width:360px;height:520px;border:0;z-index:2147483647;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18);background:transparent;";
  document.body.appendChild(frame);
})();`;
  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
