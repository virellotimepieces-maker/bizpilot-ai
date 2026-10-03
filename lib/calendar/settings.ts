import { BillingError } from "@/lib/billing/types";
import { assertWeekdayList, isKnownTimeZone } from "./availability";
import { CALENDAR_WEEKDAYS, type CalendarBookingSettingsRecord, type CalendarWeekday } from "./types";

export const CALENDAR_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
export const CALENDAR_NOTICE_OPTIONS = [0, 30, 60, 120, 240, 1440] as const;
export const CALENDAR_BUFFER_OPTIONS = [0, 10, 15, 30, 45, 60] as const;

export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export function defaultCalendarSettings(timeZone = "UTC"): {
  durationMinutes: number;
  availableDays: CalendarWeekday[];
  startMinutes: number;
  endMinutes: number;
  timezone: string;
  minNoticeMinutes: number;
  bufferMinutes: number;
} {
  return {
    durationMinutes: 30,
    availableDays: ["mon", "tue", "wed", "thu", "fri"],
    startMinutes: 9 * 60,
    endMinutes: 17 * 60,
    timezone: isKnownTimeZone(timeZone) ? timeZone : "UTC",
    minNoticeMinutes: 60,
    bufferMinutes: 0,
  };
}

export function minutesToClock(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function clockToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

export function publicBookingSettings(row: CalendarBookingSettingsRecord | null) {
  const settings = row ?? null;
  if (!settings) return null;
  return {
    durationMinutes: settings.durationMinutes,
    availableDays: settings.availableDays,
    startTime: minutesToClock(settings.startMinutes),
    endTime: minutesToClock(settings.endMinutes),
    timezone: settings.timezone,
    minNoticeMinutes: settings.minNoticeMinutes,
    bufferMinutes: settings.bufferMinutes,
  };
}

export function parseCalendarSettingsInput(body: unknown) {
  const row = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  if (!row) throw new BillingError("Calendar settings are missing.", "invalid");
  const durationMinutes = Number(row.durationMinutes);
  const minNoticeMinutes = Number(row.minNoticeMinutes);
  const bufferMinutes = Number(row.bufferMinutes);
  const startMinutes = typeof row.startTime === "string" ? clockToMinutes(row.startTime) : null;
  const endMinutes = typeof row.endTime === "string" ? clockToMinutes(row.endTime) : null;
  const availableDays = assertWeekdayList(row.availableDays);
  const timezone = typeof row.timezone === "string" ? row.timezone.trim() : "";
  if (!CALENDAR_DURATION_OPTIONS.includes(durationMinutes as (typeof CALENDAR_DURATION_OPTIONS)[number])) {
    throw new BillingError("Choose a supported appointment duration.", "invalid");
  }
  if (!CALENDAR_NOTICE_OPTIONS.includes(minNoticeMinutes as (typeof CALENDAR_NOTICE_OPTIONS)[number])) {
    throw new BillingError("Choose a supported booking notice.", "invalid");
  }
  if (!CALENDAR_BUFFER_OPTIONS.includes(bufferMinutes as (typeof CALENDAR_BUFFER_OPTIONS)[number])) {
    throw new BillingError("Choose a supported buffer.", "invalid");
  }
  if (startMinutes === null || endMinutes === null || endMinutes - startMinutes < durationMinutes) {
    throw new BillingError("Available hours must fit the appointment duration.", "invalid");
  }
  if (!availableDays.length) throw new BillingError("Choose at least one available day.", "invalid");
  if (!isKnownTimeZone(timezone)) throw new BillingError("Choose a valid timezone.", "invalid");
  const calendarId = typeof row.calendarId === "string" ? row.calendarId.trim() : "";
  return {
    durationMinutes,
    availableDays,
    startMinutes,
    endMinutes,
    timezone,
    minNoticeMinutes,
    bufferMinutes,
    calendarId,
    weekdays: CALENDAR_WEEKDAYS,
  };
}
