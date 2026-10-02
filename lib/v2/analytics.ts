import { CUSTOMER_INTENT_LABEL, leadCounts } from "./leads";
import { appointmentCounts } from "./appointments";
import { quoteCounts } from "./quotes";
import { CUSTOMER_INTENTS, type CustomerIntent } from "./enums";
import { conversationIsUnread, deskOverviewCounts } from "./metrics";
import type {
  AppointmentRequestRecord,
  KnowledgeEntryRecord,
  LeadRecord,
  QuoteRequestRecord,
  UnansweredQuestionRecord,
} from "./types";
import type { ConversationRecord } from "@/lib/billing/types";
import { BIZPILOT_PRO } from "@/lib/plan";

export const ANALYTICS_HINT =
  "Every number on this page is counted from stored workspace records. Converted is owner-marked, not a Stripe payment. Quote and appointment rows are requests, not issued quotes or calendar bookings.";

export type AnalyticsUsage = {
  used: number;
  reserved: number;
  limit: number;
  remaining: number;
  periodStart: Date;
  periodEnd: Date;
};

export type AnalyticsBreakdownRow = {
  id: string;
  label: string;
  count: number;
};

export type WorkspaceAnalytics = {
  usage: AnalyticsUsage;
  overview: ReturnType<typeof deskOverviewCounts>;
  conversations: {
    total: number;
    waitingOnHuman: number;
    unread: number;
    open: number;
    resolved: number;
  };
  leads: ReturnType<typeof leadCounts>;
  quotes: ReturnType<typeof quoteCounts>;
  appointments: ReturnType<typeof appointmentCounts>;
  unanswered: {
    total: number;
    open: number;
    answered: number;
    ignored: number;
  };
  knowledge: {
    total: number;
    enabled: number;
  };
  websitePages: number;
  intents: AnalyticsBreakdownRow[];
  leadStatuses: AnalyticsBreakdownRow[];
  hasVisitorActivity: boolean;
};

export function unansweredCounts(rows: UnansweredQuestionRecord[]) {
  return {
    total: rows.length,
    open: rows.filter((row) => row.status === "open").length,
    answered: rows.filter((row) => row.status === "answered").length,
    ignored: rows.filter((row) => row.status === "ignored").length,
  };
}

export function intentBreakdown(conversations: ConversationRecord[]): AnalyticsBreakdownRow[] {
  const counts = Object.fromEntries(CUSTOMER_INTENTS.map((id) => [id, 0])) as Record<
    CustomerIntent,
    number
  >;
  for (const row of conversations) {
    counts[row.customerIntent] += 1;
  }
  return CUSTOMER_INTENTS.map((id) => ({
    id,
    label: CUSTOMER_INTENT_LABEL[id],
    count: counts[id],
  }));
}

export function leadStatusBreakdown(leads: LeadRecord[]): AnalyticsBreakdownRow[] {
  const counts = leadCounts(leads);
  return [
    { id: "new", label: "New", count: counts.new },
    { id: "qualified", label: "Qualified", count: counts.qualified },
    { id: "follow_up", label: "Follow up", count: counts.follow_up },
    { id: "converted", label: "Converted (owner-marked)", count: leads.filter((row) => row.status === "converted").length },
    { id: "closed", label: "Closed", count: leads.filter((row) => row.status === "closed").length },
  ];
}

export function buildWorkspaceAnalytics(input: {
  conversations: ConversationRecord[];
  leads: LeadRecord[];
  quotes: QuoteRequestRecord[];
  appointments: AppointmentRequestRecord[];
  unanswered: UnansweredQuestionRecord[];
  knowledgeEntries: KnowledgeEntryRecord[];
  websitePages: number;
  usage: AnalyticsUsage;
}): WorkspaceAnalytics {
  const overview = deskOverviewCounts({
    conversations: input.conversations,
    leads: input.leads,
    unanswered: input.unanswered,
    quotes: input.quotes,
    appointments: input.appointments,
  });
  const conversations = {
    total: input.conversations.length,
    waitingOnHuman: input.conversations.filter((row) => row.waitingOnHuman).length,
    unread: input.conversations.filter(conversationIsUnread).length,
    open: input.conversations.filter((row) => row.inboxStatus === "open").length,
    resolved: input.conversations.filter((row) => row.inboxStatus === "resolved").length,
  };
  const leads = leadCounts(input.leads);
  const quotes = quoteCounts(input.quotes);
  const appointments = appointmentCounts(input.appointments);
  const unanswered = unansweredCounts(input.unanswered);
  const knowledge = {
    total: input.knowledgeEntries.length,
    enabled: input.knowledgeEntries.filter((row) => row.enabled).length,
  };
  return {
    usage: input.usage,
    overview,
    conversations,
    leads,
    quotes,
    appointments,
    unanswered,
    knowledge,
    websitePages: input.websitePages,
    intents: intentBreakdown(input.conversations),
    leadStatuses: leadStatusBreakdown(input.leads),
    hasVisitorActivity:
      conversations.total > 0 ||
      leads.total > 0 ||
      quotes.total > 0 ||
      appointments.total > 0 ||
      unanswered.total > 0 ||
      input.usage.used > 0,
  };
}

export function serializeAnalytics(row: WorkspaceAnalytics) {
  return {
    ...row,
    usage: {
      ...row.usage,
      limit: row.usage.limit || BIZPILOT_PRO.replyLimit,
      periodStart: row.usage.periodStart.toISOString(),
      periodEnd: row.usage.periodEnd.toISOString(),
    },
  };
}

export type SerializedAnalytics = ReturnType<typeof serializeAnalytics>;
