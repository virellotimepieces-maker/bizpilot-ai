import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { googleAuthUrl, GMAIL_OAUTH_COOKIE, isGmailOAuthConfigured, requireGmailOAuthConfig } from "@/lib/gmail/config";
import { createGmailOAuthState, gmailOAuthCookieOptions } from "@/lib/gmail/oauth-state";

function returnPath(request: NextRequest): "/app/email" | "/app/integrations" {
  return request.nextUrl.searchParams.get("returnTo") === "/app/integrations"
    ? "/app/integrations"
    : "/app/email";
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const returnTo = returnPath(request);
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.redirect(new URL("/login", origin));
    }
    if (!isGmailOAuthConfigured()) {
      return NextResponse.redirect(new URL(`${returnTo}?gmail=misconfigured`, origin));
    }
    const store = getBillingStore();
    const workspaces = await store.listWorkspacesForUser(userId);
    const workspace = workspaces[0];
    if (!workspace) throw new BillingError("No workspace found.", "not_found");
    await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
    const { clientId, redirectUri } = requireGmailOAuthConfig();
    const state = await createGmailOAuthState({
      userId,
      workspaceId: workspace.id,
      nonce: randomBytes(16).toString("base64url"),
      returnTo,
    });
    const response = NextResponse.redirect(googleAuthUrl({ clientId, redirectUri, state }));
    response.cookies.set(GMAIL_OAUTH_COOKIE, state, gmailOAuthCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof BillingError && error.code === "inactive") {
      return NextResponse.redirect(new URL("/billing", origin));
    }
    return NextResponse.redirect(new URL(`${returnTo}?gmail=error`, origin));
  }
}
