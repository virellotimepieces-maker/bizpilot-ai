import { CALENDAR_WEEKDAYS, type CalendarBookingSettingsRecord, type CalendarSlot, type CalendarWeekday } from "./types";
import type { BusyInterval } from "./google";

const WEEKDAY_INDEX: Record<CalendarWeekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const PART_WEEKDAY: Record<string, CalendarWeekday> = {
  Sun: "sun",
  Mon: "mon",
  Tue: "tue",
  Wed: "wed",
  Thu: "thu",
  Fri: "fri",
  Sat: "sat",
};

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: CalendarWeekday;
};

export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = PART_WEEKDAY[parts.weekday ?? ""] ?? "mon";
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday,
  };
}

function timezoneOffsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return asUtc - Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes());
}

export function zonedTimeToUtc(
  parts: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
) {
  const utcGuess = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  const adjusted = new Date(utcGuess.getTime() - timezoneOffsetMs(utcGuess, timeZone));
  return new Date(utcGuess.getTime() - timezoneOffsetMs(adjusted, timeZone));
}

export function addLocalDays(parts: ZonedParts, days: number, timeZone: string) {
  const midday = zonedTimeToUtc({ ...parts, hour: 12, minute: 0 }, timeZone);
  return zonedParts(new Date(midday.getTime() + days * 24 * 60 * 60 * 1000), timeZone);
}

export function formatSlotLabel(start: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
}

function overlaps(start: Date, end: Date, busy: BusyInterval[]) {
  return busy.some((interval) => start < interval.end && end > interval.start);
}

export function buildAvailableSlots(input: {
  now: Date;
  settings: Pick<
    CalendarBookingSettingsRecord,
    "durationMinutes" | "availableDays" | "startMinutes" | "endMinutes" | "timezone" | "minNoticeMinutes" | "bufferMinutes"
  >;
  busy: BusyInterval[];
  window?: { start: Date; end: Date } | null;
  limit?: number;
  horizonDays?: number;
}): CalendarSlot[] {
  const limit = input.limit ?? 6;
  const horizon = input.horizonDays ?? 14;
  const duration = input.settings.durationMinutes;
  const buffer = input.settings.bufferMinutes;
  const step = duration + buffer;
  const earliest = new Date(input.now.getTime() + input.settings.minNoticeMinutes * 60 * 1000);
  const days = new Set(input.settings.availableDays);
  const today = zonedParts(input.now, input.settings.timezone);
  const slots: CalendarSlot[] = [];
  for (let offset = 0; offset <= horizon && slots.length < limit; offset += 1) {
    const local = addLocalDays(today, offset, input.settings.timezone);
    if (!days.has(local.weekday)) continue;
    for (let minute = input.settings.startMinutes; minute + duration <= input.settings.endMinutes; minute += step) {
      const start = zonedTimeToUtc(
        { year: local.year, month: local.month, day: local.day, hour: Math.floor(minute / 60), minute: minute % 60 },
        input.settings.timezone,
      );
      const end = new Date(start.getTime() + duration * 60 * 1000);
      const occupiedEnd = new Date(end.getTime() + buffer * 60 * 1000);
      if (start < earliest) continue;
      if (input.window && (start < input.window.start || start >= input.window.end)) continue;
      if (overlaps(start, occupiedEnd, input.busy)) continue;
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
        label: formatSlotLabel(start, input.settings.timezone),
      });
      if (slots.length >= limit) break;
    }
  }
  return slots;
}

const WHEN_RE =
  /\b(?:this |next )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|tonight)(?:\s+(morning|afternoon|evening))?\b/i;

export function requestedWindow(question: string, now: Date, timeZone: string): { start: Date; end: Date } | null {
  const match = question.match(WHEN_RE);
  if (!match) return null;
  const word = match[1].toLowerCase();
  const part = match[2]?.toLowerCase() ?? "";
  const today = zonedParts(now, timeZone);
  let target = today;
  if (word === "tomorrow") {
    target = addLocalDays(today, 1, timeZone);
  } else if (word === "tonight") {
    target = today;
  } else if (word !== "today") {
    const wanted = WEEKDAY_INDEX[word.slice(0, 3) as CalendarWeekday];
    const current = WEEKDAY_INDEX[today.weekday];
    let delta = (wanted - current + 7) % 7;
    if (delta === 0 && /\bnext\b/i.test(match[0])) delta = 7;
    target = addLocalDays(today, delta, timeZone);
  }
  const ranges: Record<string, [number, number]> = {
    morning: [8 * 60, 12 * 60],
    afternoon: [12 * 60, 17 * 60],
    evening: [17 * 60, 21 * 60],
  };
  const [startMinute, endMinute] = part ? ranges[part] : [0, 24 * 60];
  return {
    start: zonedTimeToUtc(
      {
        year: target.year,
        month: target.month,
        day: target.day,
        hour: Math.floor(startMinute / 60),
        minute: startMinute % 60,
      },
      timeZone,
    ),
    end: zonedTimeToUtc(
      {
        year: target.year,
        month: target.month,
        day: target.day,
        hour: Math.floor(endMinute / 60),
        minute: endMinute % 60,
      },
      timeZone,
    ),
  };
}

export function isKnownTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function assertWeekdayList(value: unknown): CalendarWeekday[] {
  if (!Array.isArray(value)) return [];
  const days: CalendarWeekday[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const day = item.toLowerCase() as CalendarWeekday;
    if (CALENDAR_WEEKDAYS.includes(day) && !days.includes(day)) days.push(day);
  }
  return days;
}
