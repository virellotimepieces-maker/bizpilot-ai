import type { KnowledgeBase } from "@/lib/types";
import type { WebsitePageRecord, WebsiteSourceRecord } from "@/lib/website/types";
import type {
  ConversationRecord,
  MembershipRecord,
  MembershipRole,
  MessageRecord,
  NotificationRecord,
  StripeEventRecord,
  SubscriptionRecord,
  SubscriptionStatus,
  UsagePeriodRecord,
  UserRecord,
  WorkspaceRecord,
} from "./types";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export interface UpsertSubscriptionInput {
  workspaceId: string;
  userId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  status: SubscriptionStatus;
  cancelAtPeriodEnd?: boolean;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  canceledAt?: Date | null;
}

export interface BillingStore {
  createUser(input: CreateUserInput): Promise<UserRecord>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;

  createWorkspace(input: { ownerUserId: string; name: string }): Promise<WorkspaceRecord>;
  getWorkspace(id: string): Promise<WorkspaceRecord | null>;
  getWorkspaceByWidgetKey(widgetKey: string): Promise<WorkspaceRecord | null>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceRecord[]>;
  updateWorkspace(
    id: string,
    patch: Partial<Pick<WorkspaceRecord, "name" | "knowledge" | "widgetKey">>,
  ): Promise<WorkspaceRecord>;

  getMembership(userId: string, workspaceId: string): Promise<MembershipRecord | null>;
  addMembership(input: {
    userId: string;
    workspaceId: string;
    role: MembershipRole;
  }): Promise<MembershipRecord>;

  getSubscriptionByWorkspace(workspaceId: string): Promise<SubscriptionRecord | null>;
  getSubscriptionByStripeId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null>;
  upsertSubscription(input: UpsertSubscriptionInput): Promise<SubscriptionRecord>;

  getUsagePeriod(workspaceId: string, periodStartMs: number): Promise<UsagePeriodRecord | null>;
  listUsagePeriods(workspaceId: string): Promise<UsagePeriodRecord[]>;
  ensureUsagePeriod(input: {
    workspaceId: string;
    subscriptionId: string;
    periodStart: Date;
    periodEnd: Date;
    replyLimit: number;
  }): Promise<UsagePeriodRecord>;
  reserveAiReply(workspaceId: string, periodStartMs: number): Promise<UsagePeriodRecord | null>;
  commitReservedAiReply(workspaceId: string, periodStartMs: number): Promise<UsagePeriodRecord | null>;
  releaseReservedAiReply(workspaceId: string, periodStartMs: number): Promise<UsagePeriodRecord | null>;

  markStripeEventProcessed(eventId: string, type: string): Promise<boolean>;
  getStripeEvent(eventId: string): Promise<StripeEventRecord | null>;

  addNotification(input: {
    userId: string;
    workspaceId: string;
    type: NotificationRecord["type"];
    message: string;
  }): Promise<NotificationRecord>;
  listNotifications(userId: string, workspaceId: string): Promise<NotificationRecord[]>;

  createConversation(input: {
    workspaceId: string;
    visitorKey: string;
  }): Promise<ConversationRecord>;
  getConversation(id: string, workspaceId: string): Promise<ConversationRecord | null>;
  listConversations(workspaceId: string): Promise<ConversationRecord[]>;
  setConversationWaiting(id: string, workspaceId: string, waiting: boolean): Promise<ConversationRecord>;
  addMessage(input: {
    workspaceId: string;
    conversationId: string;
    role: MessageRecord["role"];
    content: string;
    usageCounted: boolean;
    sources?: MessageRecord["sources"];
  }): Promise<MessageRecord>;
  listMessages(conversationId: string, workspaceId: string): Promise<MessageRecord[]>;

  saveKnowledge(workspaceId: string, knowledge: KnowledgeBase): Promise<WorkspaceRecord>;

  getWebsiteSource(workspaceId: string): Promise<WebsiteSourceRecord | null>;
  upsertWebsiteSource(input: {
    workspaceId: string;
    widgetKey: string;
    domain: string;
    verifyToken: string;
  }): Promise<WebsiteSourceRecord>;
  saveWebsiteSource(source: WebsiteSourceRecord): Promise<WebsiteSourceRecord>;
  listWebsitePages(workspaceId: string, widgetKey: string): Promise<WebsitePageRecord[]>;
  replaceWebsitePages(
    workspaceId: string,
    widgetKey: string,
    sourceId: string,
    pages: Omit<WebsitePageRecord, "id" | "workspaceId" | "widgetKey" | "sourceId">[],
  ): Promise<WebsitePageRecord[]>;
  listWebsiteSourcesDueForSync(now: Date): Promise<WebsiteSourceRecord[]>;
}
