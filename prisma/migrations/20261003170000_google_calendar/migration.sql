-- CreateTable
CREATE TABLE "GoogleCalendarConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "googleSub" TEXT,
    "encryptedRefreshToken" TEXT NOT NULL,
    "encryptedAccessToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL DEFAULT 'primary',
    "calendarSummary" TEXT NOT NULL DEFAULT 'Primary',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarBookingSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "availableDays" JSONB NOT NULL,
    "startMinutes" INTEGER NOT NULL DEFAULT 540,
    "endMinutes" INTEGER NOT NULL DEFAULT 1020,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "minNoticeMinutes" INTEGER NOT NULL DEFAULT 60,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarBookingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarBookingSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "service" TEXT NOT NULL DEFAULT '',
    "offeredSlots" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'collecting',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarBookingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarAppointment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT,
    "customerName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "service" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL DEFAULT '',
    "googleCalendarId" TEXT NOT NULL,
    "holdKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleCalendarConnection_workspaceId_key" ON "GoogleCalendarConnection"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarBookingSettings_workspaceId_key" ON "CalendarBookingSettings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarBookingSession_conversationId_key" ON "CalendarBookingSession"("conversationId");

-- CreateIndex
CREATE INDEX "CalendarBookingSession_workspaceId_idx" ON "CalendarBookingSession"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarAppointment_workspaceId_holdKey_key" ON "CalendarAppointment"("workspaceId", "holdKey");

-- CreateIndex
CREATE INDEX "CalendarAppointment_workspaceId_startsAt_idx" ON "CalendarAppointment"("workspaceId", "startsAt");

-- AddForeignKey
ALTER TABLE "GoogleCalendarConnection" ADD CONSTRAINT "GoogleCalendarConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarBookingSettings" ADD CONSTRAINT "CalendarBookingSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarBookingSession" ADD CONSTRAINT "CalendarBookingSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarBookingSession" ADD CONSTRAINT "CalendarBookingSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarAppointment" ADD CONSTRAINT "CalendarAppointment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarAppointment" ADD CONSTRAINT "CalendarAppointment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
