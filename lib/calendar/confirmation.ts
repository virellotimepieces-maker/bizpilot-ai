import type { BillingStore } from "@/lib/billing/store";
import { BillingError, type WorkspaceRecord } from "@/lib/billing/types";
import { gmailPost } from "@/lib/gmail/access";
import { buildReplyRfc822, toGmailRaw } from "@/lib/gmail/mime";
import type { CalendarAppointmentRecord } from "./types";

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export function bookingConfirmationMessage(input: {
  businessName: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  service: string;
}) {
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(input.startsAt);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: input.timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(input.startsAt);
  const durationMinutes = Math.max(1, Math.round((input.endsAt.getTime() - input.startsAt.getTime()) / 60000));
  const lines = [
    `Your appointment with ${input.businessName} is confirmed.`,
    "",
    `Date: ${date}`,
    `Time: ${time}`,
    `Timezone: ${input.timezone}`,
    `Duration: ${durationMinutes} minutes`,
  ];
  const details = input.service.trim();
  if (details) lines.push(`Details: ${details}`);
  return {
    subject: `Appointment confirmed - ${input.businessName}`,
    body: lines.join("\n"),
  };
}

function canSendFromGmail(scopes: string) {
  return scopes.split(/\s+/).some((scope) => scope === "gmail.send" || scope === GMAIL_SEND_SCOPE);
}

export async function sendBookingConfirmation(input: {
  store: BillingStore;
  workspace: WorkspaceRecord;
  appointment: CalendarAppointmentRecord;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  if (input.appointment.workspaceId !== input.workspace.id || !input.appointment.googleEventId) return false;
  const gmail = await input.store.getGmailConnection(input.workspace.id);
  if (!gmail || gmail.workspaceId !== input.workspace.id || gmail.status !== "connected" || !canSendFromGmail(gmail.scopes)) {
    console.error(JSON.stringify({
      source: "calendar-confirmation",
      event: "confirmation_email_skipped",
      workspaceId: input.workspace.id,
      reason: gmail?.status === "connected" ? "gmail_send_scope_missing" : "gmail_not_connected",
    }));
    return false;
  }
  const claimed = await input.store.claimCalendarConfirmation(input.appointment.id, input.workspace.id);
  if (!claimed || claimed.workspaceId !== input.workspace.id) return false;
  const message = bookingConfirmationMessage({
    businessName: input.workspace.name,
    startsAt: claimed.startsAt,
    endsAt: claimed.endsAt,
    timezone: claimed.timezone,
    service: claimed.service,
  });
  try {
    await gmailPost(
      input.store,
      input.workspace,
      "/messages/send",
      {
        raw: toGmailRaw(buildReplyRfc822({
          fromEmail: gmail.googleEmail,
          toEmail: claimed.email,
          subject: message.subject,
          body: message.body,
        })),
      },
      input.fetchImpl,
    );
    return true;
  } catch (error) {
    await input.store.releaseCalendarConfirmation(input.appointment.id, input.workspace.id);
    console.error(JSON.stringify({
      source: "calendar-confirmation",
      event: "confirmation_email_failed",
      workspaceId: input.workspace.id,
      code: error instanceof BillingError ? error.code : "invalid",
    }));
    return false;
  }
}
