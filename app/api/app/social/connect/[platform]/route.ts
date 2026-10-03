import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { beginSocialConnect, socialReturnPath } from "@/lib/social/connect";
import { requireSocialWorkspace } from "@/lib/social/context";
import { SOCIAL_OAUTH_COOKIE, socialOAuthCookieOptions } from "@/lib/social/oauth-state";

export async function GET(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  const origin = request.nextUrl.origin;
  const returnTo = socialReturnPath(request.nextUrl.searchParams.get("returnTo"));
  const { platform } = await context.params;
  try {
    const { userId, workspace } = await requireSocialWorkspace();
    const started = await beginSocialConnect({
      userId,
      workspaceId: workspace.id,
      platform,
      returnTo,
    });
    const response = NextResponse.redirect(started.url);
    response.cookies.set(SOCIAL_OAUTH_COOKIE, started.state, socialOAuthCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof BillingError && error.code === "unauthorized") {
      return NextResponse.redirect(new URL("/login", origin));
    }
    if (error instanceof BillingError && error.code === "inactive") {
      return NextResponse.redirect(new URL("/billing", origin));
    }
    const flag = error instanceof BillingError && error.code === "misconfigured" ? "setup" : "error";
    return NextResponse.redirect(new URL(`${returnTo}?social=${flag}&platform=${platform}`, origin));
  }
}
