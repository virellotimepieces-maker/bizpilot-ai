import { NextResponse } from "next/server";
import { getBillingStore } from "@/lib/billing/factory";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token || token.length < 32) {
    return new NextResponse(null, { status: 404 });
  }
  const asset = await getBillingStore().getSocialMediaAssetByToken(token);
  if (!asset || !ALLOWED.has(asset.mimeType)) {
    return new NextResponse(null, { status: 404 });
  }
  return new NextResponse(new Uint8Array(asset.bytes), {
    status: 200,
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
