import { NextRequest, NextResponse } from "next/server";
import { getBillingStore } from "@/lib/billing/factory";
import { jsonError } from "@/lib/http";
import { runWebsiteSync } from "@/lib/website/run-sync";

function cronAuthorized(request: NextRequest) {
  if (request.headers.get("x-vercel-cron") === "1") return true;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return request.headers.get("x-vercel-cron") === "1";
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!cronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!process.env.DATABASE_URL?.trim()) {
      return NextResponse.json({ ok: true, synced: 0, skipped: "no_database" });
    }
    const store = getBillingStore();
    const due = await store.listWebsiteSourcesDueForSync(new Date());
    const results = [];
    for (const source of due) {
      const saved = await runWebsiteSync({ store, source });
      results.push({ workspaceId: saved.workspaceId, status: saved.lastSyncStatus });
    }
    return NextResponse.json({ ok: true, synced: results.length, results });
  } catch (error) {
    return jsonError(error, "Scheduled website sync failed.");
  }
}

export const POST = GET;
