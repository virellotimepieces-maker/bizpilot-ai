export const CALENDAR_WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export type CalendarWeekday = (typeof CALENDAR_WEEKDAYS)[number];

export type CalendarSlot = {
  start: string;
  end: string;
  label: string;
};

export interface GoogleCalendarConnectionRecord {
  id: string;
  workspaceId: string;
  googleEmail: string;
  googleSub: string | null;
  encryptedRefreshToken: string;
  encryptedAccessToken: string;
  accessTokenExpiresAt: Date;
  scopes: string;
  status: string;
  calendarId: string;
  calendarSummary: string;
  connectedAt: Date;
  updatedAt: Date;
}

export interface CalendarBookingSettingsRecord {
  id: string;
  workspaceId: string;
  durationMinutes: number;
  availableDays: CalendarWeekday[];
  startMinutes: number;
  endMinutes: number;
  timezone: string;
  minNoticeMinutes: number;
  bufferMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarBookingSessionRecord {
  id: string;
  workspaceId: string;
  conversationId: string;
  customerName: string;
  email: string;
  service: string;
  offeredSlots: CalendarSlot[];
  status: "collecting" | "offering" | "booked";
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarAppointmentRecord {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  customerName: string;
  email: string;
  service: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  googleEventId: string;
  googleCalendarId: string;
  holdKey: string;
  status: string;
  confirmationSentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type CalendarListEntry = {
  id: string;
  summary: string;
  primary: boolean;
  timeZone: string;
};
