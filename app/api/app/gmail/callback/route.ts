import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingError } from "@/lib/billing/types";
import { GMAIL_OAUTH_COOKIE, GMAIL_SCOPES, requireGmailOAuthConfig } from "@/lib/gmail/config";
import { exchangeGoogleAuthorizationCode, fetchGoogleUserEmail } from "@/lib/gmail/google";
import { readGmailOAuthState } from "@/lib/gmail/oauth-state";
import { encryptSecret } from "@/lib/gmail/token-crypto";

function redirectToEmail(origin: string, query: string) {
  const response = NextResponse.redirect(new URL(`/app/email?${query}`, origin));
  response.cookies.delete(GMAIL_OAUTH_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return redirectToEmail(origin, "gmail=signin");
    }
    const denied = request.nextUrl.searchParams.get("error");
    if (denied) {
      return redirectToEmail(origin, denied === "access_denied" ? "gmail=denied" : "gmail=error");
    }
    const code = request.nextUrl.searchParams.get("code");
    const stateParam = request.nextUrl.searchParams.get("state");
    const cookieState = request.cookies.get(GMAIL_OAUTH_COOKIE)?.value;
    if (!code || !stateParam || !cookieState || cookieState !== stateParam) {
      return redirectToEmail(origin, "gmail=error");
    }
    const state = await readGmailOAuthState(stateParam);
    if (!state || state.userId !== userId) {
      return redirectToEmail(origin, "gmail=error");
    }
    const { clientId, clientSecret, redirectUri } = requireGmailOAuthConfig();
    const tokens = await exchangeGoogleAuthorizationCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
    const profile = await fetchGoogleUserEmail(tokens.accessToken);
    const store = getBillingStore();
    const membership = await store.getMembership(userId, state.workspaceId);
    if (!membership) {
      return redirectToEmail(origin, "gmail=error");
    }
    await store.upsertGmailConnection({
      workspaceId: state.workspaceId,
      googleEmail: profile.email,
      googleSub: profile.sub,
      encryptedRefreshToken: encryptSecret(tokens.refreshToken!),
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      accessTokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scope || GMAIL_SCOPES.join(" "),
      status: "connected",
    });
    return redirectToEmail(origin, "gmail=connected");
  } catch (error) {
    if (error instanceof BillingError && error.code === "misconfigured") {
      return redirectToEmail(origin, "gmail=misconfigured");
    }
    return redirectToEmail(origin, "gmail=error");
  }
}
