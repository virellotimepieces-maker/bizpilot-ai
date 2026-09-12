import { BillingError } from "@/lib/billing/types";
import { GMAIL_SEND_LOCK_MS } from "./config";

export function assertSendConfirmed(confirm: unknown) {
  if (confirm !== true) {
    throw new BillingError(
      "Confirm sending this reply through Gmail before it goes out.",
      "invalid",
    );
  }
}

export function assertCanSendDraft(draft: { status: string; sendLockAt?: Date | null }, now = new Date()) {
  if (draft.status === "sent") {
    throw new BillingError("This reply was already sent.", "conflict");
  }
  if (draft.sendLockAt && now.getTime() - draft.sendLockAt.getTime() < GMAIL_SEND_LOCK_MS) {
    throw new BillingError("This reply is already being sent.", "conflict");
  }
}

export function replySubjectFor(originalSubject: string) {
  const trimmed = originalSubject.trim() || "(no subject)";
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}
