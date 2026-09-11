import { randomBytes, randomUUID } from "node:crypto";
import { BIZPILOT_PRO } from "@/lib/plan";
import type { KnowledgeBase, ReplySource } from "@/lib/types";
import type { WebsitePageKind, WebsitePageRecord, WebsiteSourceRecord } from "@/lib/website/types";
import type { BillingStore, CreateUserInput, UpsertSubscriptionInput } from "./store";
import type {
  ConversationRecord,
  MembershipRecord,
  MessageRecord,
  NotificationRecord,
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
  }) {
    const row: NotificationRecord = {
      id: randomUUID(),
      userId: input.userId,
      workspaceId: input.workspaceId,
      type: input.type,
      message: input.message,
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

  async createConversation(input: { workspaceId: string; visitorKey: string }) {
    const row: ConversationRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      visitorKey: input.visitorKey,
      waitingOnHuman: false,
      createdAt: new Date(),
    };
    this.conversations.set(row.id, row);
    return row;
  }

  async getConversation(id: string, workspaceId: string) {
    const row = this.conversations.get(id);
    if (!row || row.workspaceId !== workspaceId) return null;
    return row;
  }

  async listConversations(workspaceId: string) {
    return [...this.conversations.values()]
      .filter((row) => row.workspaceId === workspaceId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async setConversationWaiting(id: string, workspaceId: string, waiting: boolean) {
    const row = await this.getConversation(id, workspaceId);
    if (!row) throw new Error("conversation_missing");
    row.waitingOnHuman = waiting;
    return row;
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
    const row: MessageRecord = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      usageCounted: input.usageCounted,
      sources: input.sources ?? null,
      createdAt: new Date(),
    };
    this.messages.push(row);
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
}
