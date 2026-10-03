import { BillingError } from "@/lib/billing/types";

export const CALENDAR_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export const CALENDAR_OAUTH_COOKIE = "bizpilot_calendar_oauth";

export function calendarCallbackUrl(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/api/app/calendar/callback`;
}

export function isCalendarOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim() &&
      process.env.APP_URL?.trim() &&
      process.env.AUTH_SECRET?.trim(),
  );
}

export function requireCalendarOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const appUrl = process.env.APP_URL?.trim() || "";
  if (!clientId || !clientSecret || !appUrl) {
    throw new BillingError("Google Calendar is not configured.", "misconfigured");
  }
  return {
    clientId,
    clientSecret,
    appUrl: appUrl.replace(/\/$/, ""),
    redirectUri: calendarCallbackUrl(appUrl),
  };
}

export function googleCalendarAuthUrl(input: { clientId: string; redirectUri: string; state: string }) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
