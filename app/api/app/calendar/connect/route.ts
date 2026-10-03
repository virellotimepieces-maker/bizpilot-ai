import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { selectOperatingWorkspace } from "@/lib/billing/operating-workspace";
import { BillingService } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { googleCalendarAuthUrl, isCalendarOAuthConfigured, requireCalendarOAuthConfig } from "@/lib/calendar/config";
import { CALENDAR_OAUTH_COOKIE, calendarOAuthCookieOptions, createCalendarOAuthState } from "@/lib/calendar/oauth-state";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.redirect(new URL("/login", origin));
    if (!isCalendarOAuthConfigured()) {
      return NextResponse.redirect(new URL("/app/integrations?calendar=misconfigured", origin));
    }
    const store = getBillingStore();
    const workspace = await selectOperatingWorkspace(store, userId);
    if (!workspace) throw new BillingError("No workspace found.", "not_found");
    await new BillingService(store).requirePaidWorkspace(userId, workspace.id);
    const { clientId, redirectUri } = requireCalendarOAuthConfig();
    const state = await createCalendarOAuthState({
      userId,
      workspaceId: workspace.id,
      nonce: randomBytes(16).toString("base64url"),
      returnTo: "/app/integrations",
    });
    const response = NextResponse.redirect(googleCalendarAuthUrl({ clientId, redirectUri, state }));
    response.cookies.set(CALENDAR_OAUTH_COOKIE, state, calendarOAuthCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof BillingError && error.code === "inactive") {
      return NextResponse.redirect(new URL("/billing", origin));
    }
    return NextResponse.redirect(new URL("/app/integrations?calendar=error", origin));
  }
}
