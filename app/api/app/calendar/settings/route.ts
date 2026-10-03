import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { calendarAccessToken } from "@/lib/calendar/access";
import { listGoogleCalendars } from "@/lib/calendar/google";
import { publicCalendarStatus } from "@/lib/calendar/public";
import { parseCalendarSettingsInput } from "@/lib/calendar/settings";
import { BillingError } from "@/lib/billing/types";
import { requirePaidKnowledgeContext } from "@/lib/v2/knowledge-access";

export async function GET() {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const connection = await store.getGoogleCalendarConnection(workspace.id);
    const settings = await store.getCalendarBookingSettings(workspace.id);
    let calendars: { id: string; summary: string; primary: boolean; timeZone: string }[] = [];
    if (connection?.status === "connected" && connection.workspaceId === workspace.id) {
      try {
        const accessToken = await calendarAccessToken(store, connection);
        calendars = await listGoogleCalendars(accessToken);
      } catch {
        calendars = connection.calendarId
          ? [
              {
                id: connection.calendarId,
                summary: connection.calendarSummary,
                primary: connection.calendarId === "primary",
                timeZone: settings?.timezone || "UTC",
              },
            ]
          : [];
      }
    }
    return NextResponse.json({
      calendar: publicCalendarStatus(connection, settings),
      calendars,
    });
  } catch (error) {
    return jsonError(error, "Could not load Google Calendar settings.");
  }
}

export async function PUT(request: Request) {
  try {
    const { store, workspace } = await requirePaidKnowledgeContext();
    const connection = await store.getGoogleCalendarConnection(workspace.id);
    if (!connection || connection.workspaceId !== workspace.id || connection.status !== "connected") {
      throw new BillingError("Connect Google Calendar before changing booking hours.", "not_found");
    }
    const parsed = parseCalendarSettingsInput(await request.json());
    let calendarSummary = connection.calendarSummary;
    if (parsed.calendarId && parsed.calendarId !== connection.calendarId) {
      const accessToken = await calendarAccessToken(store, connection);
      const calendars = await listGoogleCalendars(accessToken);
      const selected = calendars.find((calendar) => calendar.id === parsed.calendarId);
      if (!selected) throw new BillingError("Choose a calendar from the connected Google account.", "invalid");
      calendarSummary = selected.summary;
      await store.updateGoogleCalendarConnection(workspace.id, {
        calendarId: selected.id,
        calendarSummary: selected.summary,
      });
    }
    const settings = await store.upsertCalendarBookingSettings({
      workspaceId: workspace.id,
      durationMinutes: parsed.durationMinutes,
      availableDays: parsed.availableDays,
      startMinutes: parsed.startMinutes,
      endMinutes: parsed.endMinutes,
      timezone: parsed.timezone,
      minNoticeMinutes: parsed.minNoticeMinutes,
      bufferMinutes: parsed.bufferMinutes,
    });
    const saved = parsed.calendarId
      ? await store.getGoogleCalendarConnection(workspace.id)
      : connection;
    return NextResponse.json({
      calendar: publicCalendarStatus(saved, settings),
      calendarSummary,
    });
  } catch (error) {
    return jsonError(error, "Could not save Google Calendar settings.");
  }
}
