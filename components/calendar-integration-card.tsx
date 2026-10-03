"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  CALENDAR_BUFFER_OPTIONS,
  CALENDAR_DURATION_OPTIONS,
  CALENDAR_NOTICE_OPTIONS,
  COMMON_TIMEZONES,
} from "@/lib/calendar/settings";
import { CALENDAR_WEEKDAYS, type CalendarWeekday } from "@/lib/calendar/types";
import { HELPER_TEXT_CLASS } from "@/lib/ui/type-scale";
import type { CalendarIntegrationStatus } from "@/lib/v2/integrations";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

type CalendarDraft = {
  durationMinutes: number;
  availableDays: CalendarWeekday[];
  startTime: string;
  endTime: string;
  timezone: string;
  minNoticeMinutes: number;
  bufferMinutes: number;
  calendarId: string;
};

const DAY_LABEL: Record<CalendarWeekday, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function badgeVariant(label: string) {
  if (label === "Connected") return "default" as const;
  if (label === "Needs reconnect") return "destructive" as const;
  return "outline" as const;
}

export function CalendarIntegrationCard({
  calendar,
  notice,
  onNotice,
  onChanged,
}: {
  calendar: CalendarIntegrationStatus;
  notice: string;
  onNotice: (message: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState("");
  const [calendars, setCalendars] = useState<{ id: string; summary: string }[]>([]);
  const [draft, setDraft] = useState<CalendarDraft | null>(null);

  useEffect(() => {
    if (!calendar.connected || !calendar.settings) {
      setDraft(null);
      return;
    }
    setDraft({
      ...calendar.settings,
      availableDays: calendar.settings.availableDays,
      calendarId: calendar.calendarId ?? "",
    });
  }, [calendar]);

  useEffect(() => {
    if (!calendar.connected) return;
    let cancelled = false;
    void fetch("/api/app/calendar/settings")
      .then((response) => response.json())
      .then((payload: { calendars?: { id: string; summary: string }[] }) => {
        if (!cancelled && Array.isArray(payload.calendars)) setCalendars(payload.calendars);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [calendar.connected, calendar.calendarId]);

  async function disconnect() {
    setBusy("disconnect");
    const response = await fetch("/api/app/calendar", { method: "DELETE" });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      onNotice(payload.error || "Could not disconnect Google Calendar.");
      setBusy("");
      return;
    }
    onNotice("Google Calendar is disconnected.");
    setBusy("");
    await onChanged();
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    const response = await fetch("/api/app/calendar/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      onNotice(payload.error || "Could not save calendar settings.");
      setBusy("");
      return;
    }
    onNotice("Calendar booking hours are saved for this workspace.");
    setBusy("");
    await onChanged();
  }

  function toggleDay(day: CalendarWeekday) {
    setDraft((current) => {
      if (!current) return current;
      const has = current.availableDays.includes(day);
      const availableDays = has
        ? current.availableDays.filter((item) => item !== day)
        : CALENDAR_WEEKDAYS.filter((item) => item === day || current.availableDays.includes(item));
      return { ...current, availableDays };
    });
  }

  const timezones = draft && !COMMON_TIMEZONES.includes(draft.timezone as (typeof COMMON_TIMEZONES)[number])
    ? [draft.timezone, ...COMMON_TIMEZONES]
    : [...COMMON_TIMEZONES];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <CardTitle>Calendar</CardTitle>
          </div>
          <Badge variant={badgeVariant(calendar.label)}>{calendar.label}</Badge>
        </div>
        <CardDescription>
          Each workspace connects its own Google account. Open times come from that calendar.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {notice ? <p className={HELPER_TEXT_CLASS}>{notice}</p> : null}
        {!calendar.configured ? (
          <p className={HELPER_TEXT_CLASS}>Google Calendar OAuth is not configured on the server yet.</p>
        ) : null}
        {calendar.connected && calendar.googleEmail ? (
          <p className={HELPER_TEXT_CLASS}>
            Connected Google account: {calendar.googleEmail}. Selected calendar: {calendar.calendarSummary}.
          </p>
        ) : (
          <p className={HELPER_TEXT_CLASS}>
            Appointment requests stay in this workspace until Google Calendar is connected. The assistant will not
            invent open times.
          </p>
        )}
        {calendar.configured && (!calendar.connected || calendar.needsReconnect) ? (
          <Button size="sm" render={<a href="/api/app/calendar/connect" />}>
            {calendar.needsReconnect ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </Button>
        ) : null}
        {calendar.connected && draft ? (
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="calendar-choice">Selected calendar</Label>
              <select
                id="calendar-choice"
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={draft.calendarId}
                onChange={(event) => setDraft({ ...draft, calendarId: event.target.value })}
              >
                {calendars.length ? null : (
                  <option value={draft.calendarId}>{calendar.calendarSummary || "Primary"}</option>
                )}
                {calendars.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.summary}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="calendar-duration">Appointment duration</Label>
                <select
                  id="calendar-duration"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.durationMinutes}
                  onChange={(event) => setDraft({ ...draft, durationMinutes: Number(event.target.value) })}
                >
                  {CALENDAR_DURATION_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} minutes
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calendar-timezone">Timezone</Label>
                <select
                  id="calendar-timezone"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.timezone}
                  onChange={(event) => setDraft({ ...draft, timezone: event.target.value })}
                >
                  {timezones.map((zone) => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calendar-start">Available from</Label>
                <input
                  id="calendar-start"
                  type="time"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.startTime}
                  onChange={(event) => setDraft({ ...draft, startTime: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calendar-end">Available until</Label>
                <input
                  id="calendar-end"
                  type="time"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.endTime}
                  onChange={(event) => setDraft({ ...draft, endTime: event.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calendar-notice">Minimum booking notice</Label>
                <select
                  id="calendar-notice"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.minNoticeMinutes}
                  onChange={(event) => setDraft({ ...draft, minNoticeMinutes: Number(event.target.value) })}
                >
                  {CALENDAR_NOTICE_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? "None" : minutes >= 1440 ? "1 day" : `${minutes} minutes`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="calendar-buffer">Buffer between appointments</Label>
                <select
                  id="calendar-buffer"
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={draft.bufferMinutes}
                  onChange={(event) => setDraft({ ...draft, bufferMinutes: Number(event.target.value) })}
                >
                  {CALENDAR_BUFFER_OPTIONS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? "None" : `${minutes} minutes`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Available days</Label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_WEEKDAYS.map((day) => {
                  const selected = draft.availableDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={selected}
                      className={`min-h-11 rounded-md border px-3 text-sm ${selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-input bg-transparent"}`}
                      onClick={() => toggleDay(day)}
                    >
                      {DAY_LABEL[day]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void save()} disabled={busy === "save"}>
                {busy === "save" ? "Saving" : "Save booking hours"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => void disconnect()} disabled={busy === "disconnect"}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
