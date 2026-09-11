import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { newWebsiteVerifyToken } from "@/lib/website/sync";
import { normalizeWebsiteDomain } from "@/lib/website/urls";
import { verificationInstructions } from "@/lib/website/verify";

async function paidContext() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspaces = await store.listWorkspacesForUser(userId);
  const workspace = workspaces[0];
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const paid = await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
  return { store, ...paid };
}

export async function GET() {
  try {
    const { store, workspace } = await paidContext();
    const source = await store.getWebsiteSource(workspace.id);
    return NextResponse.json({
      source,
      widgetKey: workspace.widgetKey,
      verifyHint: source
        ? verificationInstructions(source.domain, workspace.widgetKey, source.verifyToken)
        : "",
    });
  } catch (error) {
    return jsonError(error, "Could not load website indexing.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { store, workspace } = await paidContext();
    const body = (await request.json()) as { domain?: string };
    const domain = normalizeWebsiteDomain(body.domain ?? "");
    if (!domain) throw new BillingError("Enter a public website domain such as shop.example.com.", "invalid");
    const source = await store.upsertWebsiteSource({
      workspaceId: workspace.id,
      widgetKey: workspace.widgetKey,
      domain,
      verifyToken: newWebsiteVerifyToken(),
    });
    return NextResponse.json({
      source,
      widgetKey: workspace.widgetKey,
      verifyHint: verificationInstructions(source.domain, workspace.widgetKey, source.verifyToken),
    });
  } catch (error) {
    return jsonError(error, "Could not save the website domain.");
  }
}
