import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { normalizeKnowledge } from "@/lib/empty-knowledge";
import type { KnowledgeBase, ReplySource } from "@/lib/types";
import { BIZPILOT_PRO } from "@/lib/plan";
import { getPrisma } from "@/lib/db";
import type { WebsitePageKind, WebsitePageRecord, WebsiteSourceRecord, WebsiteSyncStatus } from "@/lib/website/types";
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

function asKnowledge(value: unknown): KnowledgeBase | null {
  if (!value || typeof value !== "object") return null;
  return normalizeKnowledge(value as KnowledgeBase);
}

function mapUser(row: { id: string; email: string; passwordHash: string; name: string; createdAt: Date }): UserRecord {
  return row;
}

function mapWorkspace(row: {
  id: string;
  name: string;
  ownerUserId: string;
  widgetKey: string;
  knowledge: unknown;
  createdAt: Date;
}): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.ownerUserId,
    widgetKey: row.widgetKey,
    knowledge: asKnowledge(row.knowledge),
    createdAt: row.createdAt,
  };
}

function mapSubscription(row: {
  id: string;
  workspaceId: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  updatedAt: Date;
}): SubscriptionRecord {
  return {
    ...row,
    status: row.status as SubscriptionRecord["status"],
  };
}

function mapUsage(row: {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  replyLimit: number;
  repliesUsed: number;
  repliesReserved: number;
}): UsagePeriodRecord {
  return row;
}

function asReplySources(value: unknown): ReplySource[] | null {
  if (!Array.isArray(value)) return null;
  return value.filter((row): row is ReplySource => {
    if (!row || typeof row !== "object") return false;
    const item = row as { kind?: unknown; title?: unknown };
    return typeof item.kind === "string" && typeof item.title === "string";
  });
}

function mapSocialMessage(row: {
  id: string;
  workspaceId: string;
  widgetKey: string;
  platform: string;
  fromName: string;
  handle: string;
  body: string;
  conversationUrl: string | null;
  status: string;
  draftBody: string;
  intent: string;
  sources: unknown;
  operatorNote: string;
  usedInternalKnowledge: boolean;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SocialMessageRecord {
  return {
    ...row,
    sources: asReplySources(row.sources),
  };
}

function asSources(value: unknown): MessageRecord["sources"] {
  if (!Array.isArray(value)) return null;
  return value.filter((row): row is NonNullable<MessageRecord["sources"]>[number] => {
    if (!row || typeof row !== "object") return false;
    const item = row as { title?: unknown; url?: unknown; kind?: unknown };
    return typeof item.title === "string" && typeof item.url === "string";
  });
}

function mapMessage(row: {
  id: string;
  workspaceId: string;
  conversationId: string;
  role: string;
  content: string;
  usageCounted: boolean;
  sources?: unknown;
  createdAt: Date;
}): MessageRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    role: row.role as MessageRecord["role"],
    content: row.content,
    usageCounted: row.usageCounted,
    sources: asSources(row.sources),
    createdAt: row.createdAt,
  };
}

function mapWebsiteSource(row: {
  id: string;
  workspaceId: string;
  widgetKey: string;
  domain: string;
  verifyToken: string;
  verifiedAt: Date | null;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
  lastSyncDiagnostic: string | null;
  lastSyncPageCount: number;
  conflictWarning: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WebsiteSourceRecord {
  return {
    ...row,
    lastSyncStatus: row.lastSyncStatus as WebsiteSyncStatus,
  };
}

function mapWebsitePage(row: {
  id: string;
  workspaceId: string;
  widgetKey: string;
  sourceId: string;
  url: string;
  title: string;
  kind: string;
  content: string;
  contentHash: string;
  lastModified: Date | null;
  fetchedAt: Date;
}): WebsitePageRecord {
  return {
    ...row,
    kind: row.kind as WebsitePageKind,
  };
}

export class PrismaBillingStore implements BillingStore {
  private prisma() {
    return getPrisma();
  }

  async createUser(input: CreateUserInput) {
    const row = await this.prisma().user.create({
      data: {
        email: input.email.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        name: input.name.trim(),
      },
    });
    return mapUser(row);
  }

  async findUserByEmail(email: string) {
    const row = await this.prisma().user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    return row ? mapUser(row) : null;
  }

  async findUserById(id: string) {
    const row = await this.prisma().user.findUnique({ where: { id } });
    return row ? mapUser(row) : null;
  }

  async createWorkspace(input: { ownerUserId: string; name: string }) {
    const row = await this.prisma().workspace.create({
      data: {
        name: input.name.trim() || "Untitled business",
        ownerUserId: input.ownerUserId,
        widgetKey: newWidgetKey(),
        memberships: {
          create: { userId: input.ownerUserId, role: "owner" },
        },
      },
    });
    return mapWorkspace(row);
  }

  async getWorkspace(id: string) {
    const row = await this.prisma().workspace.findUnique({ where: { id } });
    return row ? mapWorkspace(row) : null;
  }

  async getWorkspaceByWidgetKey(widgetKey: string) {
    const row = await this.prisma().workspace.findUnique({ where: { widgetKey } });
    return row ? mapWorkspace(row) : null;
  }

  async listWorkspacesForUser(userId: string) {
    const rows = await this.prisma().membership.findMany({
      where: { userId },
      include: { workspace: true },
    });
    return rows.map((row) => mapWorkspace(row.workspace));
  }

  async updateWorkspace(
    id: string,
    patch: Partial<Pick<WorkspaceRecord, "name" | "knowledge" | "widgetKey">>,
  ) {
    const row = await this.prisma().workspace.update({
      where: { id },
      data: {
        name: patch.name,
        widgetKey: patch.widgetKey,
        knowledge: patch.knowledge === undefined ? undefined : (patch.knowledge as unknown as Prisma.InputJsonValue),
      },
    });
    return mapWorkspace(row);
  }

  async getMembership(userId: string, workspaceId: string) {
    const row = await this.prisma().membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    return row as MembershipRecord | null;
  }

  async addMembership(input: { userId: string; workspaceId: string; role: "owner" | "member" }) {
    const row = await this.prisma().membership.upsert({
      where: { userId_workspaceId: { userId: input.userId, workspaceId: input.workspaceId } },
      update: { role: input.role },
      create: input,
    });
    return row as MembershipRecord;
  }

  async getSubscriptionByWorkspace(workspaceId: string) {
    const row = await this.prisma().subscription.findUnique({ where: { workspaceId } });
    return row ? mapSubscription(row) : null;
  }

  async getSubscriptionByStripeId(stripeSubscriptionId: string) {
    const row = await this.prisma().subscription.findUnique({
      where: { stripeSubscriptionId },
    });
    return row ? mapSubscription(row) : null;
  }

  async upsertSubscription(input: UpsertSubscriptionInput) {
    const current = await this.prisma().subscription.findUnique({
      where: { workspaceId: input.workspaceId },
    });
    const data = {
      userId: input.userId,
      stripeCustomerId:
        input.stripeCustomerId === undefined
          ? (current?.stripeCustomerId ?? null)
          : input.stripeCustomerId,
      stripeSubscriptionId:
        input.stripeSubscriptionId === undefined
          ? (current?.stripeSubscriptionId ?? null)
          : input.stripeSubscriptionId,
      stripePriceId:
        input.stripePriceId === undefined ? (current?.stripePriceId ?? null) : input.stripePriceId,
      status: input.status,
      cancelAtPeriodEnd:
        input.cancelAtPeriodEnd === undefined
          ? (current?.cancelAtPeriodEnd ?? false)
          : input.cancelAtPeriodEnd,
      currentPeriodStart:
        input.currentPeriodStart === undefined
          ? (current?.currentPeriodStart ?? null)
          : input.currentPeriodStart,
      currentPeriodEnd:
        input.currentPeriodEnd === undefined
          ? (current?.currentPeriodEnd ?? null)
          : input.currentPeriodEnd,
      canceledAt:
        input.canceledAt === undefined ? (current?.canceledAt ?? null) : input.canceledAt,
    };
    const row = current
      ? await this.prisma().subscription.update({
          where: { workspaceId: input.workspaceId },
          data,
        })
      : await this.prisma().subscription.create({
          data: { workspaceId: input.workspaceId, ...data },
        });
    return mapSubscription(row);
  }

  async getUsagePeriod(workspaceId: string, periodStartMs: number) {
    const row = await this.prisma().usagePeriod.findUnique({
      where: { workspaceId_periodStart: { workspaceId, periodStart: new Date(periodStartMs) } },
    });
    return row ? mapUsage(row) : null;
  }

  async listUsagePeriods(workspaceId: string) {
    const rows = await this.prisma().usagePeriod.findMany({ where: { workspaceId } });
    return rows.map(mapUsage);
  }

  async ensureUsagePeriod(input: {
    workspaceId: string;
    subscriptionId: string;
    periodStart: Date;
    periodEnd: Date;
    replyLimit: number;
  }) {
    const row = await this.prisma().usagePeriod.upsert({
      where: {
        workspaceId_periodStart: {
          workspaceId: input.workspaceId,
          periodStart: input.periodStart,
        },
      },
      update: {},
      create: {
        workspaceId: input.workspaceId,
        subscriptionId: input.subscriptionId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        replyLimit: input.replyLimit ?? BIZPILOT_PRO.replyLimit,
      },
    });
    return mapUsage(row);
  }

  async reserveAiReply(workspaceId: string, periodStartMs: number) {
    const periodStart = new Date(periodStartMs);
    const updated = await this.prisma().$executeRaw`
      UPDATE "UsagePeriod"
      SET "repliesReserved" = "repliesReserved" + 1
      WHERE "workspaceId" = ${workspaceId}
        AND "periodStart" = ${periodStart}
        AND "repliesUsed" + "repliesReserved" < "replyLimit"
    `;
    if (updated !== 1) return null;
    return this.getUsagePeriod(workspaceId, periodStartMs);
  }

  async commitReservedAiReply(workspaceId: string, periodStartMs: number) {
    const periodStart = new Date(periodStartMs);
    const updated = await this.prisma().$executeRaw`
      UPDATE "UsagePeriod"
      SET "repliesReserved" = "repliesReserved" - 1,
          "repliesUsed" = "repliesUsed" + 1
      WHERE "workspaceId" = ${workspaceId}
        AND "periodStart" = ${periodStart}
        AND "repliesReserved" > 0
    `;
    if (updated !== 1) return null;
    return this.getUsagePeriod(workspaceId, periodStartMs);
  }

  async releaseReservedAiReply(workspaceId: string, periodStartMs: number) {
    const periodStart = new Date(periodStartMs);
    const updated = await this.prisma().$executeRaw`
      UPDATE "UsagePeriod"
      SET "repliesReserved" = "repliesReserved" - 1
      WHERE "workspaceId" = ${workspaceId}
        AND "periodStart" = ${periodStart}
        AND "repliesReserved" > 0
    `;
    if (updated !== 1) return null;
    return this.getUsagePeriod(workspaceId, periodStartMs);
  }

  async markStripeEventProcessed(eventId: string, type: string) {
    try {
      await this.prisma().stripeEvent.create({ data: { id: eventId, type } });
      return true;
    } catch {
      return false;
    }
  }

  async getStripeEvent(eventId: string) {
    const row = await this.prisma().stripeEvent.findUnique({ where: { id: eventId } });
    return row as StripeEventRecord | null;
  }

  async addNotification(input: {
    userId: string;
    workspaceId: string;
    type: NotificationRecord["type"];
    message: string;
  }) {
    const row = await this.prisma().notification.create({ data: input });
    return row as NotificationRecord;
  }

  async listNotifications(userId: string, workspaceId: string) {
    const rows = await this.prisma().notification.findMany({
      where: { userId, workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows as NotificationRecord[];
  }

  async createConversation(input: { workspaceId: string; visitorKey: string }) {
    const row = await this.prisma().conversation.create({ data: input });
    return row as ConversationRecord;
  }

  async getConversation(id: string, workspaceId: string) {
    const row = await this.prisma().conversation.findFirst({
      where: { id, workspaceId },
    });
    return row as ConversationRecord | null;
  }

  async listConversations(workspaceId: string) {
    const rows = await this.prisma().conversation.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows as ConversationRecord[];
  }

  async setConversationWaiting(id: string, workspaceId: string, waiting: boolean) {
    const existing = await this.getConversation(id, workspaceId);
    if (!existing) throw new Error("conversation_missing");
    const row = await this.prisma().conversation.update({
      where: { id },
      data: { waitingOnHuman: waiting },
    });
    return row as ConversationRecord;
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
    const row = await this.prisma().message.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        usageCounted: input.usageCounted,
        sources: input.sources === undefined ? undefined : (input.sources as Prisma.InputJsonValue),
      },
    });
    return mapMessage(row);
  }

  async listMessages(conversationId: string, workspaceId: string) {
    const conversation = await this.getConversation(conversationId, workspaceId);
    if (!conversation) return [];
    const rows = await this.prisma().message.findMany({
      where: { conversationId, workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(mapMessage);
  }

  async saveKnowledge(workspaceId: string, knowledge: KnowledgeBase) {
    return this.updateWorkspace(workspaceId, { knowledge });
  }

  async getWebsiteSource(workspaceId: string) {
    const row = await this.prisma().websiteSource.findUnique({ where: { workspaceId } });
    return row ? mapWebsiteSource(row) : null;
  }

  async upsertWebsiteSource(input: {
    workspaceId: string;
    widgetKey: string;
    domain: string;
    verifyToken: string;
  }) {
    const current = await this.getWebsiteSource(input.workspaceId);
    const domainChanged = current?.domain !== input.domain;
    const row = await this.prisma().websiteSource.upsert({
      where: { workspaceId: input.workspaceId },
      create: {
        workspaceId: input.workspaceId,
        widgetKey: input.widgetKey,
        domain: input.domain,
        verifyToken: input.verifyToken,
      },
      update: {
        widgetKey: input.widgetKey,
        domain: input.domain,
        verifyToken: current?.verifyToken ?? input.verifyToken,
        ...(domainChanged
          ? {
              verifiedAt: null,
              lastSyncAt: null,
              nextSyncAt: null,
              lastSyncStatus: "idle",
              lastSyncError: null,
              lastSyncDiagnostic: null,
              lastSyncPageCount: 0,
              conflictWarning: null,
            }
          : {}),
      },
    });
    return mapWebsiteSource(row);
  }

  async saveWebsiteSource(source: WebsiteSourceRecord) {
    const row = await this.prisma().websiteSource.update({
      where: { id: source.id },
      data: {
        widgetKey: source.widgetKey,
        domain: source.domain,
        verifyToken: source.verifyToken,
        verifiedAt: source.verifiedAt,
        lastSyncAt: source.lastSyncAt,
        nextSyncAt: source.nextSyncAt,
        lastSyncStatus: source.lastSyncStatus,
        lastSyncError: source.lastSyncError,
        lastSyncDiagnostic: source.lastSyncDiagnostic,
        lastSyncPageCount: source.lastSyncPageCount,
        conflictWarning: source.conflictWarning,
      },
    });
    return mapWebsiteSource(row);
  }

  async listWebsitePages(workspaceId: string, widgetKey: string) {
    const rows = await this.prisma().websitePage.findMany({
      where: { workspaceId, widgetKey },
      orderBy: { fetchedAt: "desc" },
    });
    return rows.map(mapWebsitePage);
  }

  async replaceWebsitePages(
    workspaceId: string,
    widgetKey: string,
    sourceId: string,
    pages: Omit<WebsitePageRecord, "id" | "workspaceId" | "widgetKey" | "sourceId">[],
  ) {
    await this.prisma().websitePage.deleteMany({ where: { workspaceId, widgetKey } });
    if (!pages.length) return [];
    await this.prisma().websitePage.createMany({
      data: pages.map((page) => ({
        workspaceId,
        widgetKey,
        sourceId,
        url: page.url,
        title: page.title,
        kind: page.kind,
        content: page.content,
        contentHash: page.contentHash,
        lastModified: page.lastModified,
        fetchedAt: page.fetchedAt,
      })),
    });
    return this.listWebsitePages(workspaceId, widgetKey);
  }

  async listWebsiteSourcesDueForSync(now: Date) {
    const rows = await this.prisma().websiteSource.findMany({
      where: {
        verifiedAt: { not: null },
        lastSyncStatus: { not: "syncing" },
        nextSyncAt: { lte: now },
      },
    });
    return rows.map(mapWebsiteSource);
  }

  async listSocialMessages(workspaceId: string, widgetKey: string) {
    const rows = await this.prisma().socialMessage.findMany({
      where: { workspaceId, widgetKey },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapSocialMessage);
  }

  async getSocialMessage(id: string, workspaceId: string, widgetKey: string) {
    const row = await this.prisma().socialMessage.findFirst({
      where: { id, workspaceId, widgetKey },
    });
    return row ? mapSocialMessage(row) : null;
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
    const row = await this.prisma().socialMessage.create({
      data: {
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
        sources: input.sources === undefined || input.sources === null
          ? undefined
          : (input.sources as unknown as Prisma.InputJsonValue),
        operatorNote: input.operatorNote,
        usedInternalKnowledge: input.usedInternalKnowledge,
      },
    });
    return mapSocialMessage(row);
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
    const existing = await this.getSocialMessage(id, workspaceId, widgetKey);
    if (!existing) throw new Error("social_missing");
    const row = await this.prisma().socialMessage.update({
      where: { id },
      data: {
        ...(patch.draftBody !== undefined ? { draftBody: patch.draftBody } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.postedAt !== undefined ? { postedAt: patch.postedAt } : {}),
        ...(patch.operatorNote !== undefined ? { operatorNote: patch.operatorNote } : {}),
        ...(patch.intent !== undefined ? { intent: patch.intent } : {}),
        ...(patch.sources !== undefined
          ? { sources: (patch.sources ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.usedInternalKnowledge !== undefined
          ? { usedInternalKnowledge: patch.usedInternalKnowledge }
          : {}),
      },
    });
    return mapSocialMessage(row);
  }
}
