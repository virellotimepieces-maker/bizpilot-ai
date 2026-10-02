import type { ConversationRecord } from "@/lib/billing/types";
import type {
  AppointmentRequestRecord,
  DeskOverviewCounts,
  LeadRecord,
  QuoteRequestRecord,
  UnansweredQuestionRecord,
} from "./types";

export function conversationIsUnread(conversation: ConversationRecord) {
  if (!conversation.ownerLastReadAt) return true;
  return conversation.lastMessageAt.getTime() > conversation.ownerLastReadAt.getTime();
}

export function deskOverviewCounts(input: {
  conversations: ConversationRecord[];
  leads: LeadRecord[];
  unanswered: UnansweredQuestionRecord[];
  quotes: QuoteRequestRecord[];
  appointments: AppointmentRequestRecord[];
}): DeskOverviewCounts {
  return {
    conversationsTotal: input.conversations.length,
    conversationsNeedingHuman: input.conversations.filter((row) => row.waitingOnHuman).length,
    conversationsUnread: input.conversations.filter(conversationIsUnread).length,
    conversationsOpen: input.conversations.filter((row) => row.inboxStatus === "open").length,
    leadsNew: input.leads.filter((row) => row.status === "new").length,
    leadsQualified: input.leads.filter((row) => row.status === "qualified").length,
    unansweredOpen: input.unanswered.filter((row) => row.status === "open").length,
    quoteRequestsOpen: input.quotes.filter((row) => row.status === "requested" || row.status === "in_review").length,
    appointmentRequestsOpen: input.appointments.filter(
      (row) => row.status === "requested" || row.status === "in_review",
    ).length,
  };
}
