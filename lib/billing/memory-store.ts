import { randomBytes, randomUUID } from "node:crypto";
import { BIZPILOT_PRO } from "@/lib/plan";
import type { KnowledgeBase, ReplySource } from "@/lib/types";
import { applyConversationPatch, newConversationRecord, type ConversationV2Patch } from "@/lib/v2/conversation";
import { knowledgeEntryMatchesQuery } from "@/lib/v2/knowledge-entries";
import {
  newAppointmentRequest,
  newIntegrationConnection,
  newKnowledgeEntry,
  newLead,
  newQuoteRequest,
  newUnansweredQuestion,
  patchKnowledgeEntry,
  patchLead,
} from "@/lib/v2/records";
import { requireAppointmentStatus, requireQuoteStatus, requireUnansweredStatus } from "@/lib/v2/assert";
import type {
  AppointmentRequestRecord,
  IntegrationConnectionRecord,
  KnowledgeEntryFilters,
  KnowledgeEntryInput,
  KnowledgeEntryRecord,
  LeadInput,
  LeadRecord,
  QuoteRequestRecord,
  UnansweredQuestionRecord,
  WidgetSettingsInput,
  WidgetSettingsRecord,
} from "@/lib/v2/types";
import { defaultWidgetSettings, mergeWidgetSettings } from "@/lib/v2/widget-settings";
import type { WebsitePageKind, WebsitePageRecord, WebsiteSourceRecord } from "@/lib/website/types";
import type { BillingStore, CreateUserInput, UpsertSubscriptionInput } from "./store";
import type {
  ConversationRecord,
  MembershipRecord,
  MessageRecord,
  NotificationRecord,
  EmailDraftRecord,
  GmailConnectionRecord,
  GmailReplyDraftRecord,
  SocialMessageRecord,
  StripeEventRecord,
  SubscriptionRecord,
  UsagePeriodRecord,
  UserRecord,
  WorkspaceRecord,
} from "./types";

function newWidgetKey() {
  return `bpw_${randomBytes(24).toString("base64url")}`;
}

export class MemoryBillingStore implements BillingStore {
  users = new Map<string, UserRecord>();
  usersByEmail = new Map<string, string>();
  workspaces = new Map<string, WorkspaceRecord>();
  workspacesByWidget = new Map<string, string>();
  memberships: MembershipRecord[] = [];
  subscriptionsByWorkspace = new Map<string, SubscriptionRecord>();
  subscriptionsByStripe = new Map<string, string>();
  usage = new Map<string, UsagePeriodRecord>();
  stripeEvents = new Map<string, StripeEventRecord>();
  notifications: NotificationRecord[] = [];
  conversations = new Map<string, ConversationRecord>();
  messages: MessageRecord[] = [];
  socialMessages: SocialMessageRecord[] = [];
  emailDrafts: EmailDraftRecord[] = [];
  gmailConnections = new Map<string, GmailConnectionRecord>();
  gmailReplyDrafts: GmailReplyDraftRecord[] = [];
  knowledgeEntries: KnowledgeEntryRecord[] = [];
  unansweredQuestions: UnansweredQuestionRecord[] = [];
  leads: LeadRecord[] = [];
  quoteRequests: QuoteRequestRecord[] = [];
  appointmentRequests: AppointmentRequestRecord[] = [];
  widgetSettings = new Map<string, WidgetSettingsRecord>();
  integrationConnections: IntegrationConnectionRecord[] = [];
  private locks = new Map<string, Promise<void>>();

  private async withLock<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(
      key,
      previous.then(() => next),
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const email = input.email.trim().toLowerCase();
    if (this.usersByEmail.has(email)) {
      throw new Error("email_taken");
    }
    const user: UserRecord = {
      id: randomUUID(),
      email,
      passwordHash: input.passwordHash,
      name: input.name.trim(),
      createdAt: new Date(),
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(email, user.id);
    return user;
  }

  async findUserByEmail(email: string) {
    const id = this.usersByEmail.get(email.trim().toLowerCase());
    return id ? (this.users.get(id) ?? null) : null;
  }

  async findUserById(id: string) {
    return this.users.get(id) ?? null;
  }

  async updateUserPassword(id: string, passwordHash: string) {
    const user = this.users.get(id);
    if (!user) throw new Error("user_missing");
    const next = { ...user, passwordHash };
    this.users.set(id, next);
    return next;
  }

  async createWorkspace(input: { ownerUserId: string; name: string }) {
    const workspace: WorkspaceRecord = {
      id: randomUUID(),
      name: input.name.trim() || "Untitled business",
      ownerUserId: input.ownerUserId,
      widgetKey: newWidgetKey(),
      knowledge: null,
      createdAt: new Date(),
    };
    this.workspaces.set(workspace.id, workspace);
    this.workspacesByWidget.set(workspace.widgetKey, workspace.id);
    await this.addMembership({
      userId: input.ownerUserId,
      workspaceId: workspace.id,
      role: "owner",
    });
    return workspace;
  }

  async getWorkspace(id: string) {
    return this.workspaces.get(id) ?? null;
  }

  async getWorkspaceByWidgetKey(widgetKey: string) {
    const id = this.workspacesByWidget.get(widgetKey);
    return id ? (this.workspaces.get(id) ?? null) : null;
  }

  async listWorkspacesForUser(userId: string) {
    const ids = this.memberships.filter((m) => m.userId === userId).map((m) => m.workspaceId);
    return ids
      .map((id) => this.workspaces.get(id))
      .filter((w): w is WorkspaceRecord => Boolean(w));
  }

  async updateWorkspace(
    id: string,
    patch: Partial<Pick<WorkspaceRecord, "name" | "knowledge" | "widgetKey">>,
  ) {
    const current = this.workspaces.get(id);
    if (!current) throw new Error("workspace_missing");
    if (patch.widgetKey && patch.widgetKey !== current.widgetKey) {
      this.workspacesByWidget.delete(current.widgetKey);
      this.workspacesByWidget.set(patch.widgetKey, id);
    }
    const next = { ...current, ...patch };
    this.workspaces.set(id, next);
    return next;
  }

  async getMembership(userId: string, workspaceId: string) {
    return (
      this.memberships.find((m) => m.userId === userId && m.workspaceId === workspaceId) ?? null
    );
  }

  async addMembership(input: { userId: string; workspaceId: string; role: "owner" | "member" }) {
    const existing = await this.getMembership(input.userId, input.workspaceId);
    if (existing) return existing;
    const row: MembershipRecord = {
      id: randomUUID(),
      userId: input.userId,
      workspaceId: input.workspaceId,
      role: input.role,
    };
    this.memberships.push(row);
    return row;
  }

  async getSubscriptionByWorkspace(workspaceId: string) {
    return this.subscriptionsByWorkspace.get(workspaceId) ?? null;
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string) {
    const workspaceId = this.subscriptionsByStripe.get(stripeSubscriptionId);
    return workspaceId ? (this.subscriptionsByWorkspace.get(workspaceId) ?? null) : null;
  }

  async upsertSubscription(input: UpsertSubscriptionInput) {
    const current = this.subscriptionsByWorkspace.get(input.workspaceId);
    const row: SubscriptionRecord = {
      id: current?.id ?? randomUUID(),
      workspaceId: input.workspaceId,
      userId: input.userId,
      stripeCustomerId: input.stripeCustomerId ?? current?.stripeCustomerId ?? null,
      stripeSubscriptionId: input.stripeSubscriptionId ?? current?.stripeSubscriptionId ?? null,
      stripePriceId: input.stripePriceId ?? current?.stripePriceId ?? null,
      status: input.status,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? current?.cancelAtPeriodEnd ?? false,
      currentPeriodStart:
        input.currentPeriodStart === undefined
          ? (current?.currentPeriodStart ?? null)
          : input.currentPeriodStart,
      currentPeriodEnd:
        input.currentPeriodEnd === undefined
          ? (current?.currentPeriodEnd ?? null)
          : input.currentPeriodEnd,
      canceledAt: input.canceledAt === undefined ? (current?.canceledAt ?? null) : input.canceledAt,
      updatedAt: new Date(),
    };
    this.subscriptionsByWorkspace.set(input.workspaceId, row);
    if (row.stripeSubscriptionId) {
      this.subscriptionsByStripe.set(row.stripeSubscriptionId, input.workspaceId);
    }
    return row;
  }

  private usageKey(workspaceId: string, periodStartMs: number) {
    return `${workspaceId}:${periodStartMs}`;
  }

  async getUsagePeriod(workspaceId: string, periodStartMs: number) {
    return this.usage.get(this.usageKey(workspaceId, periodStartMs)) ?? null;
  }

  async listUsagePeriods(workspaceId: string) {
    return [...this.usage.values()].filter((row) => row.workspaceId === workspaceId);
  }

  async ensureUsagePeriod(input: {
    workspaceId: string;
    subscriptionId: string;
    periodStart: Date;
    periodEnd: Date;
    replyLimit: number;
  }) {
    const key = this.usageKey(input.workspaceId, input.periodStart.getTime());
    const existing = this.usage.get(key);
    if (existing) return existing;
    const row: UsagePeriodRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      subscriptionId: input.subscriptionId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      replyLimit: input.replyLimit ?? BIZPILOT_PRO.replyLimit,
      repliesUsed: 0,
      repliesReserved: 0,
    };
    this.usage.set(key, row);
    return row;
  }

  async reserveAiReply(workspaceId: string, periodStartMs: number) {
    return this.withLock(`${workspaceId}:${periodStartMs}`, async () => {
      const row = this.usage.get(this.usageKey(workspaceId, periodStartMs));
      if (!row) return null;
      if (row.repliesUsed + row.repliesReserved >= row.replyLimit) return null;
      row.repliesReserved += 1;
      return { ...row };
    });
  }

  async commitReservedAiReply(workspaceId: string, periodStartMs: number) {
    return this.withLock(`${workspaceId}:${periodStartMs}`, async () => {
      const row = this.usage.get(this.usageKey(workspaceId, periodStartMs));
      if (!row || row.repliesReserved < 1) return null;
      row.repliesReserved -= 1;
      row.repliesUsed += 1;
      return { ...row };
    });
  }

  async releaseReservedAiReply(workspaceId: string, periodStartMs: number) {
    return this.withLock(`${workspaceId}:${periodStartMs}`, async () => {
      const row = this.usage.get(this.usageKey(workspaceId, periodStartMs));
      if (!row || row.repliesReserved < 1) return null;
      row.repliesReserved -= 1;
      return { ...row };
    });
  }

  async markStripeEventProcessed(eventId: string, type: string) {
    if (this.stripeEvents.has(eventId)) return false;
    this.stripeEvents.set(eventId, { id: eventId, type, processedAt: new Date() });
    return true;
  }

  async getStripeEvent(eventId: string) {
    return this.stripeEvents.get(eventId) ?? null;
  }

  async addNotification(input: {
    userId: string;
    workspaceId: string;
    type: NotificationRecord["type"];
    message: string;
    relatedType?: string;
    relatedId?: string;
  }) {
    const row: NotificationRecord = {
      id: randomUUID(),
      userId: input.userId,
      workspaceId: input.workspaceId,
      type: input.type,
      message: input.message,
      relatedType: input.relatedType ?? "",
      relatedId: input.relatedId ?? "",
      createdAt: new Date(),
      readAt: null,
    };
    this.notifications.push(row);
    return row;
  }

  async listNotifications(userId: string, workspaceId: string) {
    return this.notifications.filter(
      (row) => row.userId === userId && row.workspaceId === workspaceId,
    );
  }

  async markNotificationRead(id: string, userId: string, workspaceId: string, now = new Date()) {
    const row = this.notifications.find(
      (item) => item.id === id && item.userId === userId && item.workspaceId === workspaceId,
    );
    if (!row) throw new Error("notification_missing");
    row.readAt = now;
    return row;
  }

  async createConversation(input: { workspaceId: string; visitorKey: string }) {
    const row = newConversationRecord({
      id: randomUUID(),
      workspaceId: input.workspaceId,
      visitorKey: input.visitorKey,
    });
    this.conversations.set(row.id, row);
    return row;
  }

  async getConversation(id: string, workspaceId: string) {
    const row = this.conversations.get(id);
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  async getConversationForVisitor(
    workspaceId: string,
    visitorKey: string,
    conversationId?: string,
  ) {
    if (conversationId) {
      const row = await this.getConversation(conversationId, workspaceId);
      if (!row || row.visitorKey !== visitorKey) return null;
      return row;
    }
    return (
      [...this.conversations.values()]
        .filter((row) => row.workspaceId === workspaceId && row.visitorKey === visitorKey)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    );
  }

  async listConversations(workspaceId: string) {
    return [...this.conversations.values()]
      .filter((row) => row.workspaceId === workspaceId)
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async countWaitingConversations(workspaceId: string) {
    return [...this.conversations.values()].filter(
      (row) => row.workspaceId === workspaceId && row.waitingOnHuman,
    ).length;
  }

  async setConversationWaiting(id: string, workspaceId: string, waiting: boolean) {
    const row = await this.getConversation(id, workspaceId);
    if (!row) throw new Error("conversation_missing");
    row.waitingOnHuman = waiting;
    return row;
  }

  async updateConversation(id: string, workspaceId: string, patch: ConversationV2Patch) {
    const row = await this.getConversation(id, workspaceId);
    if (!row) throw new Error("conversation_missing");
    const next = applyConversationPatch(row, patch);
    this.conversations.set(id, next);
    return next;
  }

  async markConversationRead(id: string, workspaceId: string, now = new Date()) {
    return this.updateConversation(id, workspaceId, { ownerLastReadAt: now });
  }

  async addMessage(input: {
    workspaceId: string;
    conversationId: string;
    role: MessageRecord["role"];
    content: string;
    usageCounted: boolean;
    sources?: MessageRecord["sources"];
  }) {
    const conversation = await this.getConversation(input.conversationId, input.workspaceId);
    if (!conversation) throw new Error("conversation_missing");
    const createdAt = new Date();
    const row: MessageRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      usageCounted: input.usageCounted,
      sources: input.sources ?? null,
      createdAt,
    };
    this.messages.push(row);
    this.conversations.set(conversation.id, { ...conversation, lastMessageAt: createdAt });
    return row;
  }

  async listMessages(conversationId: string, workspaceId: string) {
    const conversation = await this.getConversation(conversationId, workspaceId);
    if (!conversation) return [];
    return this.messages.filter(
      (row) => row.conversationId === conversationId && row.workspaceId === workspaceId,
    );
  }

  async saveKnowledge(workspaceId: string, knowledge: KnowledgeBase) {
    return this.updateWorkspace(workspaceId, { knowledge });
  }

  websiteSources = new Map<string, WebsiteSourceRecord>();
  websitePages: WebsitePageRecord[] = [];

  async getWebsiteSource(workspaceId: string) {
    return this.websiteSources.get(workspaceId) ?? null;
  }

  async upsertWebsiteSource(input: {
    workspaceId: string;
    widgetKey: string;
    domain: string;
    verifyToken: string;
  }) {
    const current = this.websiteSources.get(input.workspaceId);
    const now = new Date();
    const row: WebsiteSourceRecord = {
      id: current?.id ?? randomUUID(),
      workspaceId: input.workspaceId,
      widgetKey: input.widgetKey,
      domain: input.domain,
      verifyToken: current?.verifyToken ?? input.verifyToken,
      verifiedAt: current?.domain === input.domain ? current.verifiedAt : null,
      lastSyncAt: current?.domain === input.domain ? current.lastSyncAt : null,
      nextSyncAt: current?.domain === input.domain ? current.nextSyncAt : null,
      lastSyncStatus: current?.domain === input.domain ? current.lastSyncStatus : "idle",
      lastSyncError: current?.domain === input.domain ? current.lastSyncError : null,
      lastSyncDiagnostic: current?.domain === input.domain ? current.lastSyncDiagnostic : null,
      lastSyncPageCount: current?.domain === input.domain ? current.lastSyncPageCount : 0,
      conflictWarning: current?.domain === input.domain ? current.conflictWarning : null,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
    };
    this.websiteSources.set(input.workspaceId, row);
    return row;
  }

  async saveWebsiteSource(source: WebsiteSourceRecord) {
    const row = { ...source, updatedAt: new Date() };
    this.websiteSources.set(source.workspaceId, row);
    return row;
  }

  async listWebsitePages(workspaceId: string, widgetKey: string) {
    return this.websitePages.filter(
      (row) => row.workspaceId === workspaceId && row.widgetKey === widgetKey,
    );
  }

  async replaceWebsitePages(
    workspaceId: string,
    widgetKey: string,
    sourceId: string,
    pages: Omit<WebsitePageRecord, "id" | "workspaceId" | "widgetKey" | "sourceId">[],
  ) {
    this.websitePages = this.websitePages.filter(
      (row) => !(row.workspaceId === workspaceId && row.widgetKey === widgetKey),
    );
    const stored = pages.map((page) => ({
      ...page,
      id: randomUUID(),
      workspaceId,
      widgetKey,
      sourceId,
      kind: page.kind as WebsitePageKind,
    }));
    this.websitePages.push(...stored);
    return stored;
  }

  async listWebsiteSourcesDueForSync(now: Date) {
    return [...this.websiteSources.values()].filter(
      (row) =>
        Boolean(row.verifiedAt) &&
        row.lastSyncStatus !== "syncing" &&
        row.nextSyncAt !== null &&
        row.nextSyncAt.getTime() <= now.getTime(),
    );
  }

  async listSocialMessages(workspaceId: string, widgetKey: string) {
    return this.socialMessages
      .filter((row) => row.workspaceId === workspaceId && row.widgetKey === widgetKey)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getSocialMessage(id: string, workspaceId: string, widgetKey: string) {
    const row = this.socialMessages.find((item) => item.id === id);
    if (!row || row.workspaceId !== workspaceId || row.widgetKey !== widgetKey) return null;
    return row;
  }

  async createSocialMessage(input: {
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
  }) {
    const now = new Date();
    const row: SocialMessageRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      widgetKey: input.widgetKey,
      platform: input.platform,
      fromName: input.fromName,
      handle: input.handle,
      body: input.body,
      conversationUrl: input.conversationUrl ?? null,
      status: input.status,
      draftBody: input.draftBody,
      intent: input.intent,
      sources: input.sources ?? null,
      operatorNote: input.operatorNote,
      usedInternalKnowledge: input.usedInternalKnowledge,
      postedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.socialMessages.push(row);
    return row;
  }

  async updateSocialMessage(
    id: string,
    workspaceId: string,
    widgetKey: string,
    patch: Partial<
      Pick<
        SocialMessageRecord,
        "draftBody" | "status" | "postedAt" | "operatorNote" | "intent" | "sources" | "usedInternalKnowledge"
      >
    >,
  ) {
    const row = await this.getSocialMessage(id, workspaceId, widgetKey);
    if (!row) throw new Error("social_missing");
    if (patch.draftBody !== undefined) row.draftBody = patch.draftBody;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.postedAt !== undefined) row.postedAt = patch.postedAt;
    if (patch.operatorNote !== undefined) row.operatorNote = patch.operatorNote;
    if (patch.intent !== undefined) row.intent = patch.intent;
    if (patch.sources !== undefined) row.sources = patch.sources;
    if (patch.usedInternalKnowledge !== undefined) {
      row.usedInternalKnowledge = patch.usedInternalKnowledge;
    }
    row.updatedAt = new Date();
    return row;
  }

  async listEmailDrafts(workspaceId: string, widgetKey: string) {
    return this.emailDrafts
      .filter((row) => row.workspaceId === workspaceId && row.widgetKey === widgetKey)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getEmailDraft(id: string, workspaceId: string, widgetKey: string) {
    const row = this.emailDrafts.find((item) => item.id === id);
    if (!row || row.workspaceId !== workspaceId || row.widgetKey !== widgetKey) return null;
    return row;
  }

  async createEmailDraft(input: {
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
  }) {
    const now = new Date();
    const row: EmailDraftRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      widgetKey: input.widgetKey,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      subject: input.subject,
      body: input.body,
      status: input.status,
      draftSubject: input.draftSubject,
      draftBody: input.draftBody,
      intent: input.intent,
      sources: input.sources ?? null,
      operatorNote: input.operatorNote,
      usedInternalKnowledge: input.usedInternalKnowledge,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.emailDrafts.push(row);
    return row;
  }

  async updateEmailDraft(
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
  ) {
    const row = await this.getEmailDraft(id, workspaceId, widgetKey);
    if (!row) throw new Error("email_missing");
    if (patch.draftBody !== undefined) row.draftBody = patch.draftBody;
    if (patch.draftSubject !== undefined) row.draftSubject = patch.draftSubject;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.sentAt !== undefined) row.sentAt = patch.sentAt;
    if (patch.operatorNote !== undefined) row.operatorNote = patch.operatorNote;
    if (patch.intent !== undefined) row.intent = patch.intent;
    if (patch.sources !== undefined) row.sources = patch.sources;
    if (patch.usedInternalKnowledge !== undefined) {
      row.usedInternalKnowledge = patch.usedInternalKnowledge;
    }
    row.updatedAt = new Date();
    return row;
  }

  async getGmailConnection(workspaceId: string) {
    return this.gmailConnections.get(workspaceId) ?? null;
  }

  async upsertGmailConnection(input: {
    workspaceId: string;
    googleEmail: string;
    googleSub?: string | null;
    encryptedRefreshToken: string;
    encryptedAccessToken: string;
    accessTokenExpiresAt: Date;
    scopes: string;
    status: string;
  }) {
    const now = new Date();
    const existing = this.gmailConnections.get(input.workspaceId);
    const row: GmailConnectionRecord = {
      id: existing?.id ?? randomUUID(),
      workspaceId: input.workspaceId,
      googleEmail: input.googleEmail,
      googleSub: input.googleSub ?? null,
      encryptedRefreshToken: input.encryptedRefreshToken,
      encryptedAccessToken: input.encryptedAccessToken,
      accessTokenExpiresAt: input.accessTokenExpiresAt,
      scopes: input.scopes,
      status: input.status,
      connectedAt: existing?.connectedAt ?? now,
      updatedAt: now,
    };
    this.gmailConnections.set(input.workspaceId, row);
    return row;
  }

  async updateGmailConnection(
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
  ) {
    const row = this.gmailConnections.get(workspaceId);
    if (!row) throw new Error("gmail_missing");
    if (patch.googleEmail !== undefined) row.googleEmail = patch.googleEmail;
    if (patch.googleSub !== undefined) row.googleSub = patch.googleSub;
    if (patch.encryptedRefreshToken !== undefined) row.encryptedRefreshToken = patch.encryptedRefreshToken;
    if (patch.encryptedAccessToken !== undefined) row.encryptedAccessToken = patch.encryptedAccessToken;
    if (patch.accessTokenExpiresAt !== undefined) row.accessTokenExpiresAt = patch.accessTokenExpiresAt;
    if (patch.scopes !== undefined) row.scopes = patch.scopes;
    if (patch.status !== undefined) row.status = patch.status;
    row.updatedAt = new Date();
    return row;
  }

  async deleteGmailConnection(workspaceId: string) {
    this.gmailConnections.delete(workspaceId);
    this.gmailReplyDrafts = this.gmailReplyDrafts.filter((row) => row.workspaceId !== workspaceId);
  }

  async getGmailReplyDraft(workspaceId: string, gmailMessageId: string) {
    return (
      this.gmailReplyDrafts.find(
        (row) => row.workspaceId === workspaceId && row.gmailMessageId === gmailMessageId,
      ) ?? null
    );
  }

  async upsertGmailReplyDraft(input: {
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
  }) {
    const now = new Date();
    const existing = await this.getGmailReplyDraft(input.workspaceId, input.gmailMessageId);
    if (existing) {
      existing.gmailThreadId = input.gmailThreadId;
      existing.rfcMessageId = input.rfcMessageId ?? existing.rfcMessageId;
      existing.fromName = input.fromName;
      existing.fromEmail = input.fromEmail;
      existing.subject = input.subject;
      existing.body = input.body;
      existing.receivedAt = input.receivedAt ?? existing.receivedAt;
      if (existing.status !== "sent") {
        existing.draftSubject = input.draftSubject;
        existing.draftBody = input.draftBody;
        existing.intent = input.intent;
        existing.sources = input.sources ?? existing.sources;
        existing.operatorNote = input.operatorNote;
        existing.usedInternalKnowledge = input.usedInternalKnowledge;
        existing.status = input.status;
      }
      existing.updatedAt = now;
      return existing;
    }
    const row: GmailReplyDraftRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      gmailMessageId: input.gmailMessageId,
      gmailThreadId: input.gmailThreadId,
      rfcMessageId: input.rfcMessageId ?? null,
      fromName: input.fromName,
      fromEmail: input.fromEmail,
      subject: input.subject,
      body: input.body,
      receivedAt: input.receivedAt ?? null,
      draftSubject: input.draftSubject,
      draftBody: input.draftBody,
      intent: input.intent,
      sources: input.sources ?? null,
      operatorNote: input.operatorNote,
      usedInternalKnowledge: input.usedInternalKnowledge,
      status: input.status,
      sentAt: null,
      sendLockAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.gmailReplyDrafts.push(row);
    return row;
  }

  async updateGmailReplyDraft(
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
  ) {
    const row = await this.getGmailReplyDraft(workspaceId, gmailMessageId);
    if (!row) throw new Error("gmail_draft_missing");
    if (patch.draftSubject !== undefined) row.draftSubject = patch.draftSubject;
    if (patch.draftBody !== undefined) row.draftBody = patch.draftBody;
    if (patch.intent !== undefined) row.intent = patch.intent;
    if (patch.sources !== undefined) row.sources = patch.sources;
    if (patch.operatorNote !== undefined) row.operatorNote = patch.operatorNote;
    if (patch.usedInternalKnowledge !== undefined) row.usedInternalKnowledge = patch.usedInternalKnowledge;
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.sentAt !== undefined) row.sentAt = patch.sentAt;
    if (patch.sendLockAt !== undefined) row.sendLockAt = patch.sendLockAt;
    if (patch.rfcMessageId !== undefined) row.rfcMessageId = patch.rfcMessageId;
    if (patch.gmailThreadId !== undefined) row.gmailThreadId = patch.gmailThreadId;
    if (patch.fromName !== undefined) row.fromName = patch.fromName;
    if (patch.fromEmail !== undefined) row.fromEmail = patch.fromEmail;
    if (patch.subject !== undefined) row.subject = patch.subject;
    if (patch.body !== undefined) row.body = patch.body;
    if (patch.receivedAt !== undefined) row.receivedAt = patch.receivedAt;
    row.updatedAt = new Date();
    return row;
  }

  async claimGmailReplySend(workspaceId: string, gmailMessageId: string, now = new Date()) {
    const row = await this.getGmailReplyDraft(workspaceId, gmailMessageId);
    if (!row) throw new Error("gmail_draft_missing");
    if (row.status === "sent") throw new Error("gmail_already_sent");
    if (row.sendLockAt && now.getTime() - row.sendLockAt.getTime() < 120_000) {
      throw new Error("gmail_send_in_progress");
    }
    row.sendLockAt = now;
    row.updatedAt = now;
    return row;
  }

  async listKnowledgeEntries(workspaceId: string, filters?: KnowledgeEntryFilters) {
    return this.knowledgeEntries
      .filter((row) => row.workspaceId === workspaceId)
      .filter((row) => (filters?.kind ? row.kind === filters.kind : true))
      .filter((row) => (filters?.enabled === undefined ? true : row.enabled === filters.enabled))
      .filter((row) => knowledgeEntryMatchesQuery(row.title, row.content, filters?.query ?? ""))
      .sort((a, b) => b.lastUpdatedAt.getTime() - a.lastUpdatedAt.getTime());
  }

  async getKnowledgeEntry(id: string, workspaceId: string) {
    return this.knowledgeEntries.find((row) => row.id === id && row.workspaceId === workspaceId) ?? null;
  }

  async createKnowledgeEntry(workspaceId: string, input: KnowledgeEntryInput) {
    const row = newKnowledgeEntry(workspaceId, input);
    this.knowledgeEntries.push(row);
    return row;
  }

  async updateKnowledgeEntry(id: string, workspaceId: string, patch: Partial<KnowledgeEntryInput>) {
    const current = await this.getKnowledgeEntry(id, workspaceId);
    if (!current) throw new Error("knowledge_entry_missing");
    const next = patchKnowledgeEntry(current, patch);
    this.knowledgeEntries = this.knowledgeEntries.map((row) => (row.id === id ? next : row));
    return next;
  }

  async deleteKnowledgeEntry(id: string, workspaceId: string) {
    const current = await this.getKnowledgeEntry(id, workspaceId);
    if (!current) throw new Error("knowledge_entry_missing");
    this.knowledgeEntries = this.knowledgeEntries.filter((row) => row.id !== id);
  }

  async listUnansweredQuestions(workspaceId: string) {
    return this.unansweredQuestions
      .filter((row) => row.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createUnansweredQuestion(input: {
    workspaceId: string;
    conversationId?: string | null;
    question: string;
    detectedLanguage?: string;
  }) {
    if (input.conversationId) {
      const conversation = await this.getConversation(input.conversationId, input.workspaceId);
      if (!conversation) throw new Error("conversation_missing");
    }
    const row = newUnansweredQuestion(input);
    this.unansweredQuestions.push(row);
    return row;
  }

  async updateUnansweredQuestion(
    id: string,
    workspaceId: string,
    patch: Partial<Pick<UnansweredQuestionRecord, "status" | "resolvedAt">>,
  ) {
    const row = this.unansweredQuestions.find((item) => item.id === id && item.workspaceId === workspaceId);
    if (!row) throw new Error("unanswered_question_missing");
    if (patch.status !== undefined) row.status = requireUnansweredStatus(patch.status);
    if (patch.resolvedAt !== undefined) row.resolvedAt = patch.resolvedAt;
    if (row.status !== "open" && !row.resolvedAt) row.resolvedAt = new Date();
    return row;
  }

  async listLeads(workspaceId: string) {
    return this.leads
      .filter((row) => row.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getLead(id: string, workspaceId: string) {
    return this.leads.find((row) => row.id === id && row.workspaceId === workspaceId) ?? null;
  }

  async createLead(workspaceId: string, input: LeadInput = {}) {
    if (input.conversationId) {
      const conversation = await this.getConversation(input.conversationId, workspaceId);
      if (!conversation) throw new Error("conversation_missing");
    }
    const row = newLead(workspaceId, input);
    this.leads.push(row);
    return row;
  }

  async updateLead(id: string, workspaceId: string, patch: LeadInput) {
    const current = await this.getLead(id, workspaceId);
    if (!current) throw new Error("lead_missing");
    if (patch.conversationId) {
      const conversation = await this.getConversation(patch.conversationId, workspaceId);
      if (!conversation) throw new Error("conversation_missing");
    }
    const next = patchLead(current, patch);
    this.leads = this.leads.map((row) => (row.id === id ? next : row));
    return next;
  }

  async listQuoteRequests(workspaceId: string) {
    return this.quoteRequests
      .filter((row) => row.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createQuoteRequest(
    workspaceId: string,
    input: Partial<
      Pick<
        QuoteRequestRecord,
        | "conversationId"
        | "leadId"
        | "customerName"
        | "email"
        | "phone"
        | "productService"
        | "requirements"
        | "notes"
        | "status"
      >
    > = {},
  ) {
    if (input.conversationId) {
      const conversation = await this.getConversation(input.conversationId, workspaceId);
      if (!conversation) throw new Error("conversation_missing");
    }
    if (input.leadId) {
      const lead = await this.getLead(input.leadId, workspaceId);
      if (!lead) throw new Error("lead_missing");
    }
    const row = newQuoteRequest(workspaceId, input);
    this.quoteRequests.push(row);
    return row;
  }

  async updateQuoteRequest(
    id: string,
    workspaceId: string,
    patch: Partial<Pick<QuoteRequestRecord, "status" | "notes" | "requirements" | "productService">>,
  ) {
    const row = this.quoteRequests.find((item) => item.id === id && item.workspaceId === workspaceId);
    if (!row) throw new Error("quote_request_missing");
    if (patch.status !== undefined) row.status = requireQuoteStatus(patch.status);
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.requirements !== undefined) row.requirements = patch.requirements;
    if (patch.productService !== undefined) row.productService = patch.productService;
    row.updatedAt = new Date();
    return row;
  }

  async listAppointmentRequests(workspaceId: string) {
    return this.appointmentRequests
      .filter((row) => row.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createAppointmentRequest(
    workspaceId: string,
    input: Partial<
      Pick<
        AppointmentRequestRecord,
        | "conversationId"
        | "leadId"
        | "customerName"
        | "email"
        | "phone"
        | "requestedService"
        | "preferredAt"
        | "notes"
        | "status"
      >
    > = {},
  ) {
    if (input.conversationId) {
      const conversation = await this.getConversation(input.conversationId, workspaceId);
      if (!conversation) throw new Error("conversation_missing");
    }
    if (input.leadId) {
      const lead = await this.getLead(input.leadId, workspaceId);
      if (!lead) throw new Error("lead_missing");
    }
    const row = newAppointmentRequest(workspaceId, input);
    this.appointmentRequests.push(row);
    return row;
  }

  async updateAppointmentRequest(
    id: string,
    workspaceId: string,
    patch: Partial<Pick<AppointmentRequestRecord, "status" | "notes" | "preferredAt" | "requestedService">>,
  ) {
    const row = this.appointmentRequests.find((item) => item.id === id && item.workspaceId === workspaceId);
    if (!row) throw new Error("appointment_request_missing");
    if (patch.status !== undefined) row.status = requireAppointmentStatus(patch.status);
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.preferredAt !== undefined) row.preferredAt = patch.preferredAt;
    if (patch.requestedService !== undefined) row.requestedService = patch.requestedService;
    row.updatedAt = new Date();
    return row;
  }

  async getWidgetSettings(workspaceId: string) {
    return this.widgetSettings.get(workspaceId) ?? null;
  }

  async upsertWidgetSettings(workspaceId: string, patch: WidgetSettingsInput = {}) {
    const current = this.widgetSettings.get(workspaceId);
    const base: WidgetSettingsRecord = current ?? {
      id: randomUUID(),
      ...defaultWidgetSettings(workspaceId),
    };
    const next = mergeWidgetSettings(base, patch);
    this.widgetSettings.set(workspaceId, next);
    return next;
  }

  async listIntegrationConnections(workspaceId: string) {
    return this.integrationConnections.filter((row) => row.workspaceId === workspaceId);
  }

  async upsertIntegrationConnection(input: {
    workspaceId: string;
    provider: IntegrationConnectionRecord["provider"];
    status?: IntegrationConnectionRecord["status"];
  }) {
    const existing = this.integrationConnections.find(
      (row) => row.workspaceId === input.workspaceId && row.provider === input.provider,
    );
    if (!existing) {
      const row = newIntegrationConnection(input);
      this.integrationConnections.push(row);
      return row;
    }
    existing.status = input.status ?? existing.status;
    existing.updatedAt = new Date();
    return existing;
  }
}
