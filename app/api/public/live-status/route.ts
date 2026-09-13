import { NextResponse } from "next/server";
import { publicLiveStatusPayload } from "@/lib/operator-setup";

export async function GET() {
  const payload = publicLiveStatusPayload();
  return NextResponse.json({
    kind: payload.kind,
    label: payload.label,
    detail: payload.detail,
    openToSubscribers: payload.openToSubscribers,
  });
}
