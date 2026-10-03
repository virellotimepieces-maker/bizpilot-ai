import type { KnowledgeBase, ReplySource } from "@/lib/types";
import type { ConversationV2Patch } from "@/lib/v2/conversation";
import type {
  AppointmentRequestRecord,
  AppointmentRequestWrite,
  IntegrationConnectionRecord,
  KnowledgeEntryFilters,
  KnowledgeEntryInput,
  KnowledgeEntryRecord,
  LeadInput,
  LeadRecord,
  QuoteRequestRecord,
  QuoteRequestWrite,
  UnansweredQuestionRecord,
  WidgetSettingsInput,
  WidgetSettingsRecord,
} from "@/lib/v2/types";
import type {
  ShopifyConnectionRecord,
  ShopifyConnectionWrite,
  ShopifyProductRecord,
  ShopifyProductWrite,
} from "@/lib/shopify/types";
import type { WebsitePageRecord, WebsiteSourceRecord } from "@/lib/website/types";
import type {
  ConversationRecord,
  MembershipRecord,
  MembershipRole,
  MessageRecord,
  NotificationRecord,
  CalendarAppointmentRecord,
  CalendarBookingSessionRecord,
  CalendarBookingSettingsRecord,
  EmailDraftRecord,
  GmailConnectionRecord,
  GoogleCalendarConnectionRecord,
  GmailReplyDraftRecord,
  SocialMessageRecord,
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
  updateUserPassword(id: string, passwordHash: string): Promise<UserRecord>;

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
    relatedType?: string;
    relatedId?: string;
  }): Promise<NotificationRecord>;
  listNotifications(userId: string, workspaceId: string): Promise<NotificationRecord[]>;
  markNotificationRead(id: string, userId: string, workspaceId: string, now?: Date): Promise<NotificationRecord>;

  createConversation(input: {
    workspaceId: string;
    visitorKey: string;
  }): Promise<ConversationRecord>;
  getConversation(id: string, workspaceId: string): Promise<ConversationRecord | null>;
  getConversationForVisitor(
    workspaceId: string,
    visitorKey: string,
    conversationId?: string,
  ): Promise<ConversationRecord | null>;
  listConversations(workspaceId: string): Promise<ConversationRecord[]>;
  countWaitingConversations(workspaceId: string): Promise<number>;
  setConversationWaiting(id: string, workspaceId: string, waiting: boolean): Promise<ConversationRecord>;
  updateConversation(id: string, workspaceId: string, patch: ConversationV2Patch): Promise<ConversationRecord>;
  markConversationRead(id: string, workspaceId: string, now?: Date): Promise<ConversationRecord>;
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

  listSocialMessages(workspaceId: string, widgetKey: string): Promise<SocialMessageRecord[]>;
  getSocialMessage(
    id: string,
    workspaceId: string,
    widgetKey: string,
  ): Promise<SocialMessageRecord | null>;
  createSocialMessage(input: {
    workspaceId: string;
    widgetKey: string;
    platform: string;
    fromName: string;
    handle: string;
    body: string;
    conversationUrl?: string | null;
    status: string;
    draftBody: string;
    intent: string;
    sources?: ReplySource[] | null;
    operatorNote: string;
    usedInternalKnowledge: boolean;
  }): Promise<SocialMessageRecord>;
  updateSocialMessage(
    id: string,
    workspaceId: string,
    widgetKey: string,
    patch: Partial<
      Pick<
        SocialMessageRecord,
        "draftBody" | "status" | "postedAt" | "operatorNote" | "intent" | "sources" | "usedInternalKnowledge"
      >
    >,
  ): Promise<SocialMessageRecord>;

  listEmailDrafts(workspaceId: string, widgetKey: string): Promise<EmailDraftRecord[]>;
  getEmailDraft(
    id: string,
    workspaceId: string,
    widgetKey: string,
  ): Promise<EmailDraftRecord | null>;
  createEmailDraft(input: {
    workspaceId: string;
    widgetKey: string;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    status: string;
    draftSubject: string;
    draftBody: string;
    intent: string;
    sources?: ReplySource[] | null;
    operatorNote: string;
    usedInternalKnowledge: boolean;
  }): Promise<EmailDraftRecord>;
  updateEmailDraft(
    id: string,
    workspaceId: string,
    widgetKey: string,
    patch: Partial<
      Pick<
        EmailDraftRecord,
        | "draftBody"
        | "draftSubject"
        | "status"
        | "sentAt"
        | "operatorNote"
        | "intent"
        | "sources"
        | "usedInternalKnowledge"
      >
    >,
  ): Promise<EmailDraftRecord>;

  getGmailConnection(workspaceId: string): Promise<GmailConnectionRecord | null>;
  upsertGmailConnection(input: {
    workspaceId: string;
    googleEmail: string;
    googleSub?: string | null;
    encryptedRefreshToken: string;
    encryptedAccessToken: string;
    accessTokenExpiresAt: Date;
    scopes: string;
    status: string;
  }): Promise<GmailConnectionRecord>;
  updateGmailConnection(
    workspaceId: string,
    patch: Partial<
      Pick<
        GmailConnectionRecord,
        | "googleEmail"
        | "googleSub"
        | "encryptedRefreshToken"
        | "encryptedAccessToken"
        | "accessTokenExpiresAt"
        | "scopes"
        | "status"
      >
    >,
  ): Promise<GmailConnectionRecord>;
  deleteGmailConnection(workspaceId: string): Promise<void>;
  getGmailReplyDraft(workspaceId: string, gmailMessageId: string): Promise<GmailReplyDraftRecord | null>;
  upsertGmailReplyDraft(input: {
    workspaceId: string;
    gmailMessageId: string;
    gmailThreadId: string;
    rfcMessageId?: string | null;
    fromName: string;
    fromEmail: string;
    subject: string;
    body: string;
    receivedAt?: Date | null;
    draftSubject: string;
    draftBody: string;
    intent: string;
    sources?: ReplySource[] | null;
    operatorNote: string;
    usedInternalKnowledge: boolean;
    status: string;
  }): Promise<GmailReplyDraftRecord>;
  updateGmailReplyDraft(
    workspaceId: string,
    gmailMessageId: string,
    patch: Partial<
      Pick<
        GmailReplyDraftRecord,
        | "draftSubject"
        | "draftBody"
        | "intent"
        | "sources"
        | "operatorNote"
        | "usedInternalKnowledge"
        | "status"
        | "sentAt"
        | "sendLockAt"
        | "rfcMessageId"
        | "gmailThreadId"
        | "fromName"
        | "fromEmail"
        | "subject"
        | "body"
        | "receivedAt"
      >
    >,
  ): Promise<GmailReplyDraftRecord>;
  claimGmailReplySend(
    workspaceId: string,
    gmailMessageId: string,
    now?: Date,
  ): Promise<GmailReplyDraftRecord>;

  getShopifyConnection(workspaceId: string): Promise<ShopifyConnectionRecord | null>;
  getShopifyConnectionByShop(shopDomain: string): Promise<ShopifyConnectionRecord | null>;
  upsertShopifyConnection(input: ShopifyConnectionWrite): Promise<ShopifyConnectionRecord>;
  updateShopifyConnection(
    workspaceId: string,
    patch: Partial<
      Omit<ShopifyConnectionRecord, "id" | "workspaceId" | "connectedAt" | "updatedAt" | "encryptedAccessToken">
    > & { encryptedAccessToken?: string },
  ): Promise<ShopifyConnectionRecord>;
  deleteShopifyConnection(workspaceId: string): Promise<void>;
  listShopifyProducts(workspaceId: string): Promise<ShopifyProductRecord[]>;
  replaceShopifyProducts(workspaceId: string, products: ShopifyProductWrite[]): Promise<ShopifyProductRecord[]>;

  listKnowledgeEntries(workspaceId: string, filters?: KnowledgeEntryFilters): Promise<KnowledgeEntryRecord[]>;
  getKnowledgeEntry(id: string, workspaceId: string): Promise<KnowledgeEntryRecord | null>;
  createKnowledgeEntry(workspaceId: string, input: KnowledgeEntryInput): Promise<KnowledgeEntryRecord>;
  updateKnowledgeEntry(
    id: string,
    workspaceId: string,
    patch: Partial<KnowledgeEntryInput>,
  ): Promise<KnowledgeEntryRecord>;
  deleteKnowledgeEntry(id: string, workspaceId: string): Promise<void>;

  listUnansweredQuestions(workspaceId: string): Promise<UnansweredQuestionRecord[]>;
  createUnansweredQuestion(input: {
    workspaceId: string;
    conversationId?: string | null;
    question: string;
    detectedLanguage?: string;
  }): Promise<UnansweredQuestionRecord>;
  updateUnansweredQuestion(
    id: string,
    workspaceId: string,
    patch: Partial<Pick<UnansweredQuestionRecord, "status" | "resolvedAt">>,
  ): Promise<UnansweredQuestionRecord>;

  listLeads(workspaceId: string): Promise<LeadRecord[]>;
  getLead(id: string, workspaceId: string): Promise<LeadRecord | null>;
  createLead(workspaceId: string, input?: LeadInput): Promise<LeadRecord>;
  updateLead(id: string, workspaceId: string, patch: LeadInput): Promise<LeadRecord>;

  listQuoteRequests(workspaceId: string): Promise<QuoteRequestRecord[]>;
  createQuoteRequest(workspaceId: string, input?: QuoteRequestWrite): Promise<QuoteRequestRecord>;
  updateQuoteRequest(
    id: string,
    workspaceId: string,
    patch: QuoteRequestWrite,
  ): Promise<QuoteRequestRecord>;

  getGoogleCalendarConnection(workspaceId: string): Promise<GoogleCalendarConnectionRecord | null>;
  upsertGoogleCalendarConnection(input: {
    workspaceId: string;
    googleEmail: string;
    googleSub?: string | null;
    encryptedRefreshToken: string;
    encryptedAccessToken: string;
    accessTokenExpiresAt: Date;
    scopes: string;
    status: string;
    calendarId: string;
    calendarSummary: string;
  }): Promise<GoogleCalendarConnectionRecord>;
  updateGoogleCalendarConnection(
    workspaceId: string,
    patch: Partial<
      Pick<
        GoogleCalendarConnectionRecord,
        | "googleEmail"
        | "googleSub"
        | "encryptedRefreshToken"
        | "encryptedAccessToken"
        | "accessTokenExpiresAt"
        | "scopes"
        | "status"
        | "calendarId"
        | "calendarSummary"
      >
    >,
  ): Promise<GoogleCalendarConnectionRecord>;
  deleteGoogleCalendarConnection(workspaceId: string): Promise<void>;
  getCalendarBookingSettings(workspaceId: string): Promise<CalendarBookingSettingsRecord | null>;
  upsertCalendarBookingSettings(input: {
    workspaceId: string;
    durationMinutes: number;
    availableDays: CalendarBookingSettingsRecord["availableDays"];
    startMinutes: number;
    endMinutes: number;
    timezone: string;
    minNoticeMinutes: number;
    bufferMinutes: number;
  }): Promise<CalendarBookingSettingsRecord>;
  getCalendarBookingSession(
    workspaceId: string,
    conversationId: string,
  ): Promise<CalendarBookingSessionRecord | null>;
  upsertCalendarBookingSession(input: {
    workspaceId: string;
    conversationId: string;
    customerName: string;
    email: string;
    service: string;
    offeredSlots: CalendarBookingSessionRecord["offeredSlots"];
    status: CalendarBookingSessionRecord["status"];
  }): Promise<CalendarBookingSessionRecord>;
  listCalendarAppointments(workspaceId: string): Promise<CalendarAppointmentRecord[]>;
  createCalendarAppointment(input: {
    workspaceId: string;
    conversationId?: string | null;
    customerName: string;
    email: string;
    service: string;
    startsAt: Date;
    endsAt: Date;
    timezone: string;
    googleCalendarId: string;
    holdKey: string;
  }): Promise<CalendarAppointmentRecord>;
  updateCalendarAppointment(
    id: string,
    workspaceId: string,
    patch: Partial<Pick<CalendarAppointmentRecord, "googleEventId" | "status">>,
  ): Promise<CalendarAppointmentRecord>;
  claimCalendarConfirmation(id: string, workspaceId: string, now?: Date): Promise<CalendarAppointmentRecord | null>;
  releaseCalendarConfirmation(id: string, workspaceId: string): Promise<void>;
  deleteCalendarAppointment(id: string, workspaceId: string): Promise<void>;

  listAppointmentRequests(workspaceId: string): Promise<AppointmentRequestRecord[]>;
  createAppointmentRequest(
    workspaceId: string,
    input?: AppointmentRequestWrite,
  ): Promise<AppointmentRequestRecord>;
  updateAppointmentRequest(
    id: string,
    workspaceId: string,
    patch: AppointmentRequestWrite,
  ): Promise<AppointmentRequestRecord>;

  getWidgetSettings(workspaceId: string): Promise<WidgetSettingsRecord | null>;
  upsertWidgetSettings(workspaceId: string, patch?: WidgetSettingsInput): Promise<WidgetSettingsRecord>;

  listIntegrationConnections(workspaceId: string): Promise<IntegrationConnectionRecord[]>;
  upsertIntegrationConnection(input: {
    workspaceId: string;
    provider: IntegrationConnectionRecord["provider"];
    status?: IntegrationConnectionRecord["status"];
  }): Promise<IntegrationConnectionRecord>;
}
