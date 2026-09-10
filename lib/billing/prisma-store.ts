import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { KnowledgeBase } from "@/lib/types";
import { BIZPILOT_PRO } from "@/lib/plan";
import { getPrisma } from "@/lib/db";
import type { BillingStore, CreateUserInput, UpsertSubscriptionInput } from "./store";
import type {
  ConversationRecord,
  MembershipRecord,
  MessageRecord,
  NotificationRecord,
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
  return value as KnowledgeBase;
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
  }) {
    const conversation = await this.getConversation(input.conversationId, input.workspaceId);
    if (!conversation) throw new Error("conversation_missing");
    const row = await this.prisma().message.create({ data: input });
    return row as MessageRecord;
  }

  async listMessages(conversationId: string, workspaceId: string) {
    const conversation = await this.getConversation(conversationId, workspaceId);
    if (!conversation) return [];
    const rows = await this.prisma().message.findMany({
      where: { conversationId, workspaceId },
      orderBy: { createdAt: "asc" },
    });
    return rows as MessageRecord[];
  }

  async saveKnowledge(workspaceId: string, knowledge: KnowledgeBase) {
    return this.updateWorkspace(workspaceId, { knowledge });
  }
}
