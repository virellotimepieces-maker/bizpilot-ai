import { NextRequest, NextResponse } from "next/server";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";

function cors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  return response;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function GET(request: NextRequest) {
  try {
    const widgetKey = request.nextUrl.searchParams.get("widgetKey")?.trim() ?? "";
    if (!widgetKey) throw new BillingError("Missing widget key.", "invalid");
    const appearance = await new BillingService(getBillingStore()).loadPublicWidgetAppearance(widgetKey);
    return cors(NextResponse.json({ appearance }));
  } catch (error) {
    return cors(jsonError(error, "Could not load widget appearance."));
  }
}
