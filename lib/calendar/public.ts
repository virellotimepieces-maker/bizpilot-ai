import { isCalendarOAuthConfigured } from "./config";
import { publicBookingSettings } from "./settings";
import type { CalendarBookingSettingsRecord, GoogleCalendarConnectionRecord } from "./types";

export type PublicCalendarStatus = {
  configured: boolean;
  connected: boolean;
  needsReconnect: boolean;
  googleEmail: string | null;
  calendarId: string | null;
  calendarSummary: string | null;
  connectedAt: string | null;
  settings: ReturnType<typeof publicBookingSettings>;
};

export function publicCalendarStatus(
  row: GoogleCalendarConnectionRecord | null,
  settings: CalendarBookingSettingsRecord | null,
): PublicCalendarStatus {
  const connected = Boolean(row && row.status === "connected");
  return {
    configured: isCalendarOAuthConfigured(),
    connected,
    needsReconnect: row?.status === "needs_reconnect",
    googleEmail: connected || row?.status === "needs_reconnect" ? row?.googleEmail ?? null : null,
    calendarId: connected ? row?.calendarId ?? null : null,
    calendarSummary: connected ? row?.calendarSummary ?? null : null,
    connectedAt: row?.connectedAt?.toISOString() ?? null,
    settings: connected ? publicBookingSettings(settings) : null,
  };
}

export function assertNoCalendarSecrets(payload: unknown) {
  const raw = JSON.stringify(payload).replace(/LINKEDIN_CLIENT_SECRET|X_CLIENT_SECRET/g, "SOCIAL_CREDENTIAL_NAME");
  if (/encryptedRefreshToken|encryptedAccessToken|refresh_token|access_token|client_secret|GOOGLE_CLIENT_SECRET/i.test(raw)) {
    throw new Error("Calendar payload leaked a credential field.");
  }
}
