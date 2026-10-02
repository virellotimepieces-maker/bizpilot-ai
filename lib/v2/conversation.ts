import type { ConversationRecord } from "@/lib/billing/types";
import { parseCustomerIntent } from "./intents";
import type { ConversationChannel, InboxStatus } from "./enums";
import { CONVERSATION_CHANNELS, INBOX_STATUSES, isOneOf } from "./enums";

export function parseInboxStatus(value: string | null | undefined): InboxStatus {
  if (value && isOneOf(value, INBOX_STATUSES)) return value;
  return "open";
}

export function parseConversationChannel(value: string | null | undefined): ConversationChannel {
  if (value && isOneOf(value, CONVERSATION_CHANNELS)) return value;
  return "website";
}

export function newConversationRecord(input: {
  id: string;
  workspaceId: string;
  visitorKey: string;
  now?: Date;
}): ConversationRecord {
  const now = input.now ?? new Date();
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    visitorKey: input.visitorKey,
    waitingOnHuman: false,
    visitorName: "",
    visitorEmail: "",
    visitorPhone: "",
    channel: "website",
    customerIntent: "general_question",
    inboxStatus: "open",
    ownerLastReadAt: null,
    lastMessageAt: now,
    aiSummary: "",
    detectedLanguage: "",
    createdAt: now,
  };
}

export type ConversationV2Patch = Partial<
  Pick<
    ConversationRecord,
    | "visitorName"
    | "visitorEmail"
    | "visitorPhone"
    | "channel"
    | "customerIntent"
    | "inboxStatus"
    | "ownerLastReadAt"
    | "aiSummary"
    | "detectedLanguage"
    | "waitingOnHuman"
  >
>;

export function applyConversationPatch(row: ConversationRecord, patch: ConversationV2Patch): ConversationRecord {
  return {
    ...row,
    visitorName: patch.visitorName ?? row.visitorName,
    visitorEmail: patch.visitorEmail ?? row.visitorEmail,
    visitorPhone: patch.visitorPhone ?? row.visitorPhone,
    channel: patch.channel ? parseConversationChannel(patch.channel) : row.channel,
    customerIntent: patch.customerIntent ? parseCustomerIntent(patch.customerIntent) : row.customerIntent,
    inboxStatus: patch.inboxStatus ? parseInboxStatus(patch.inboxStatus) : row.inboxStatus,
    ownerLastReadAt: patch.ownerLastReadAt === undefined ? row.ownerLastReadAt : patch.ownerLastReadAt,
    aiSummary: patch.aiSummary ?? row.aiSummary,
    detectedLanguage: patch.detectedLanguage ?? row.detectedLanguage,
    waitingOnHuman: patch.waitingOnHuman ?? row.waitingOnHuman,
  };
}
