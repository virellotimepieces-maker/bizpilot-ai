import { sitemapXml } from "@/lib/marketing/site";
import { publicOriginForHost } from "@/lib/public-origin";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const xml = sitemapXml(publicOriginForHost(host));
  const body = new TextEncoder().encode(xml);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
