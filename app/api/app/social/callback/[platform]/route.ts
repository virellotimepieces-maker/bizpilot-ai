import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { acceptSocialOAuthCallback } from "@/lib/social/connect";
import { SOCIAL_OAUTH_COOKIE } from "@/lib/social/oauth-state";

export async function GET(request: NextRequest, context: { params: Promise<{ platform: string }> }) {
  const origin = request.nextUrl.origin;
  const { platform } = await context.params;
  const result = await acceptSocialOAuthCallback({
    platform,
    sessionUserId: await getSessionUserId(),
    code: request.nextUrl.searchParams.get("code"),
    queryState: request.nextUrl.searchParams.get("state"),
    cookieState: request.cookies.get(SOCIAL_OAUTH_COOKIE)?.value ?? null,
    queryError: request.nextUrl.searchParams.get("error"),
    store: getBillingStore(),
  });
  const response = NextResponse.redirect(new URL(`${result.returnTo}?${result.query}`, origin));
  response.cookies.delete(SOCIAL_OAUTH_COOKIE);
  return response;
}
