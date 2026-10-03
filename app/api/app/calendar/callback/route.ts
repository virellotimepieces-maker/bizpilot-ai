import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingError } from "@/lib/billing/types";
import { CALENDAR_SCOPES, requireCalendarOAuthConfig } from "@/lib/calendar/config";
import { exchangeCalendarAuthorizationCode, listGoogleCalendars } from "@/lib/calendar/google";
import { CALENDAR_OAUTH_COOKIE, readCalendarOAuthState } from "@/lib/calendar/oauth-state";
import { defaultCalendarSettings } from "@/lib/calendar/settings";
import { fetchGoogleUserEmail } from "@/lib/gmail/google";
import { encryptSecret } from "@/lib/gmail/token-crypto";

function redirectAfter(origin: string, query: string) {
  const response = NextResponse.redirect(new URL(`/app/integrations?${query}`, origin));
  response.cookies.delete(CALENDAR_OAUTH_COOKIE);
  return response;
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  try {
    const userId = await getSessionUserId();
    if (!userId) return redirectAfter(origin, "calendar=signin");
    const denied = request.nextUrl.searchParams.get("error");
    if (denied) {
      return redirectAfter(origin, denied === "access_denied" ? "calendar=denied" : "calendar=error");
    }
    const code = request.nextUrl.searchParams.get("code");
    const stateParam = request.nextUrl.searchParams.get("state");
    const cookieState = request.cookies.get(CALENDAR_OAUTH_COOKIE)?.value;
    if (!code || !stateParam || !cookieState || cookieState !== stateParam) {
      return redirectAfter(origin, "calendar=error");
    }
    const state = await readCalendarOAuthState(stateParam);
    if (!state || state.userId !== userId) return redirectAfter(origin, "calendar=error");
    const { clientId, clientSecret, redirectUri } = requireCalendarOAuthConfig();
    const tokens = await exchangeCalendarAuthorizationCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });
    const profile = await fetchGoogleUserEmail(tokens.accessToken);
    const store = getBillingStore();
    const membership = await store.getMembership(userId, state.workspaceId);
    if (!membership) return redirectAfter(origin, "calendar=error");
    const existing = await store.getGoogleCalendarConnection(state.workspaceId);
    if (!tokens.refreshToken && !existing?.encryptedRefreshToken) {
      return redirectAfter(origin, "calendar=error");
    }
    const calendars = await listGoogleCalendars(tokens.accessToken).catch(() => []);
    const selected = calendars.find((calendar) => calendar.primary) ?? calendars[0];
    await store.upsertGoogleCalendarConnection({
      workspaceId: state.workspaceId,
      googleEmail: profile.email,
      googleSub: profile.sub,
      encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : existing!.encryptedRefreshToken,
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      accessTokenExpiresAt: tokens.expiresAt,
      scopes: tokens.scope || CALENDAR_SCOPES.join(" "),
      status: "connected",
      calendarId: selected?.id || "primary",
      calendarSummary: selected?.summary || "Primary",
    });
    const settings = await store.getCalendarBookingSettings(state.workspaceId);
    if (!settings) {
      await store.upsertCalendarBookingSettings({
        workspaceId: state.workspaceId,
        ...defaultCalendarSettings(selected?.timeZone),
      });
    }
    return redirectAfter(origin, "calendar=connected");
  } catch (error) {
    if (error instanceof BillingError && error.code === "misconfigured") {
      return redirectAfter(origin, "calendar=misconfigured");
    }
    return redirectAfter(origin, "calendar=error");
  }
}
