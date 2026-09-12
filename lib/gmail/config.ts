import { BillingError } from "@/lib/billing/types";

export const GMAIL_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
] as const;

export const GMAIL_OAUTH_COOKIE = "bizpilot_gmail_oauth";
export const GMAIL_SEND_LOCK_MS = 120_000;
export const GMAIL_INBOX_PAGE_SIZE = 30;

export function gmailCallbackUrl(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/api/app/gmail/callback`;
}

export function googleOAuthClientId() {
  return process.env.GOOGLE_CLIENT_ID?.trim() || "";
}

export function googleOAuthClientSecret() {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
}

export function isGmailOAuthConfigured() {
  return Boolean(
    googleOAuthClientId() &&
      googleOAuthClientSecret() &&
      process.env.APP_URL?.trim() &&
      process.env.AUTH_SECRET?.trim(),
  );
}

export function requireGmailOAuthConfig() {
  const clientId = googleOAuthClientId();
  const clientSecret = googleOAuthClientSecret();
  const appUrl = process.env.APP_URL?.trim() || "";
  if (!clientId || !clientSecret || !appUrl) {
    throw new BillingError("Gmail is not configured.", "misconfigured");
  }
  return {
    clientId,
    clientSecret,
    appUrl: appUrl.replace(/\/$/, ""),
    redirectUri: gmailCallbackUrl(appUrl),
  };
}

export function googleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state: input.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
