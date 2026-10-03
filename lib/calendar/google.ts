import { BillingError } from "@/lib/billing/types";
import type { CalendarListEntry } from "./types";

type FetchLike = typeof fetch;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function calendarError(status: number, mode: "connect" | "refresh" | "calendar"): BillingError {
  if (status === 401 || status === 403) {
    return new BillingError(
      mode === "connect"
        ? "Google denied this Calendar connection. Try Connect Google Calendar again."
        : "Google Calendar access was revoked or expired. Connect Google Calendar again.",
      mode === "connect" ? "invalid" : "reconnect",
    );
  }
  if (status === 409) {
    return new BillingError("That time is already booked on the calendar.", "conflict");
  }
  if (status === 429) {
    return new BillingError("Google Calendar is rate-limiting requests. Try again in a moment.", "limit");
  }
  return new BillingError("Google Calendar request failed.", "invalid");
}

export type CalendarTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
};

export async function exchangeCalendarAuthorizationCode(
  input: { code: string; clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: FetchLike = fetch,
): Promise<CalendarTokenSet> {
  const body = new URLSearchParams({
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = await readJson(response);
  if (!response.ok) {
    if (asRecord(json)?.error === "invalid_client") {
      throw new BillingError("Google Calendar is not configured.", "misconfigured");
    }
    throw calendarError(response.status, "connect");
  }
  const row = asRecord(json);
  const accessToken = typeof row?.access_token === "string" ? row.access_token : "";
  const refreshToken = typeof row?.refresh_token === "string" ? row.refresh_token : "";
  const expiresIn = typeof row?.expires_in === "number" ? row.expires_in : 3600;
  const scope = typeof row?.scope === "string" ? row.scope : "";
  if (!accessToken || !refreshToken) {
    throw new BillingError(
      "Google did not grant offline Calendar access. Connect Google Calendar again and approve the requested permissions.",
      "invalid",
    );
  }
  if (!scope.includes("https://www.googleapis.com/auth/calendar.events")) {
    throw new BillingError("Google Calendar event access was not approved.", "invalid");
  }
  return {
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + Math.max(60, expiresIn) * 1000),
    scope,
  };
}

export async function refreshCalendarAccessToken(
  input: { refreshToken: string; clientId: string; clientSecret: string },
  fetchImpl: FetchLike = fetch,
): Promise<CalendarTokenSet> {
  const body = new URLSearchParams({
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
  });
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const json = await readJson(response);
  if (!response.ok) {
    if (asRecord(json)?.error === "invalid_grant") {
      throw new BillingError("Google Calendar access was revoked or expired. Connect Google Calendar again.", "reconnect");
    }
    throw calendarError(response.status, "refresh");
  }
  const row = asRecord(json);
  const accessToken = typeof row?.access_token === "string" ? row.access_token : "";
  const expiresIn = typeof row?.expires_in === "number" ? row.expires_in : 3600;
  const scope = typeof row?.scope === "string" ? row.scope : "";
  if (!accessToken) {
    throw new BillingError("Google Calendar access was revoked or expired. Connect Google Calendar again.", "reconnect");
  }
  return {
    accessToken,
    expiresAt: new Date(Date.now() + Math.max(60, expiresIn) * 1000),
    scope,
  };
}

export async function listGoogleCalendars(
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<CalendarListEntry[]> {
  const response = await fetchImpl("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  const json = await readJson(response);
  if (!response.ok) throw calendarError(response.status, "calendar");
  const items = asRecord(json)?.items;
  if (!Array.isArray(items)) return [];
  const calendars: CalendarListEntry[] = [];
  for (const item of items) {
    const row = asRecord(item);
    const id = typeof row?.id === "string" ? row.id : "";
    if (!id) continue;
    const accessRole = typeof row?.accessRole === "string" ? row.accessRole : "";
    if (accessRole && accessRole !== "owner" && accessRole !== "writer") continue;
    calendars.push({
      id,
      summary: typeof row?.summary === "string" && row.summary.trim() ? row.summary : id,
      primary: row?.primary === true,
      timeZone: typeof row?.timeZone === "string" ? row.timeZone : "UTC",
    });
  }
  return calendars;
}

export type BusyInterval = { start: Date; end: Date };

export async function queryCalendarFreeBusy(
  input: { accessToken: string; calendarId: string; timeMin: Date; timeMax: Date },
  fetchImpl: FetchLike = fetch,
): Promise<BusyInterval[]> {
  const response = await fetchImpl("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      timeMin: input.timeMin.toISOString(),
      timeMax: input.timeMax.toISOString(),
      items: [{ id: input.calendarId }],
    }),
  });
  const json = await readJson(response);
  if (!response.ok) throw calendarError(response.status, "calendar");
  const calendars = asRecord(asRecord(json)?.calendars);
  const calendar = asRecord(calendars?.[input.calendarId]);
  const busy = calendar?.busy;
  if (!Array.isArray(busy)) return [];
  const intervals: BusyInterval[] = [];
  for (const item of busy) {
    const row = asRecord(item);
    const start = typeof row?.start === "string" ? new Date(row.start) : null;
    const end = typeof row?.end === "string" ? new Date(row.end) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) continue;
    intervals.push({ start, end });
  }
  return intervals;
}

export async function insertCalendarEvent(
  input: {
    accessToken: string;
    calendarId: string;
    summary: string;
    description: string;
    start: Date;
    end: Date;
    timeZone: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<{ id: string }> {
  const calendarId = encodeURIComponent(input.calendarId);
  const response = await fetchImpl(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=none`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
        end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
      }),
    },
  );
  const json = await readJson(response);
  if (!response.ok) throw calendarError(response.status, "calendar");
  const id = asRecord(json)?.id;
  if (typeof id !== "string" || !id) {
    throw new BillingError("Google Calendar did not return an event id.", "invalid");
  }
  return { id };
}
