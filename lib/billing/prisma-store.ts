import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { normalizeKnowledge } from "@/lib/empty-knowledge";
import type { KnowledgeBase, ReplySource } from "@/lib/types";
import { BIZPILOT_PRO } from "@/lib/plan";
import { getPrisma } from "@/lib/db";
import { applyConversationPatch, parseConversationChannel, parseInboxStatus, type ConversationV2Patch } from "@/lib/v2/conversation";
import { parseCustomerIntent } from "@/lib/v2/intents";
import { knowledgeEntryMatchesQuery } from "@/lib/v2/knowledge-entries";
import {
  mapWidgetSettings,
  newAppointmentRequest,
  newIntegrationConnection,
  newKnowledgeEntry,
  newLead,
  newQuoteRequest,
  newUnansweredQuestion,
  patchAppointmentRequest,
  patchKnowledgeEntry,
  patchLead,
  patchQuoteRequest,
} from "@/lib/v2/records";
import { requireAppointmentStatus, requireQuoteStatus, requireUnansweredStatus } from "@/lib/v2/assert";
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
} from "@/lib/v2/types";
import { defaultWidgetSettings, mergeWidgetSettings } from "@/lib/v2/widget-settings";
import { assertWeekdayList } from "@/lib/calendar/availability";
import type {
  CalendarAppointmentRecord,
  CalendarBookingSessionRecord,
  CalendarBookingSettingsRecord,
  CalendarSlot,
  GoogleCalendarConnectionRecord,
} from "@/lib/calendar/types";
import type {
  ShopifyConnectionRecord,
  ShopifyConnectionWrite,
  ShopifyProductRecord,
  ShopifyProductWrite,
  ShopifySyncStatus,
  ShopifyVariantRecord,
} from "@/lib/shopify/types";
import type { WebsitePageKind, WebsitePageRecord, WebsiteSourceRecord, WebsiteSyncStatus } from "@/lib/website/types";
import type { BillingStore, CreateUserInput, UpsertSubscriptionInput } from "./store";
import { BillingError } from "./types";
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

function mapEmailDraft(row: {
  id: string;
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
  sources: unknown;
  operatorNote: string;
  usedInternalKnowledge: boolean;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): EmailDraftRecord {
  return {
    ...row,
    sources: asReplySources(row.sources),
  };
}

function asShopifySyncStatus(value: string): ShopifySyncStatus {
  if (value === "idle" || value === "syncing" || value === "success" || value === "error") return value;
  return "idle";
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is string => typeof row === "string" && row.trim().length > 0);
}

function asShopifyVariants(value: unknown): ShopifyVariantRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.title !== "string") return [];
    return [
      {
        id: item.id,
        title: item.title,
        sku: typeof item.sku === "string" ? item.sku : "",
        price: typeof item.price === "string" ? item.price : "",
        compareAtPrice: typeof item.compareAtPrice === "string" ? item.compareAtPrice : null,
        available: typeof item.available === "boolean" ? item.available : null,
        inventoryQuantity: typeof item.inventoryQuantity === "number" ? item.inventoryQuantity : null,
        inventoryTracked: Boolean(item.inventoryTracked),
      },
    ];
  });
}

function mapShopifyConnection(row: {
  id: string;
  workspaceId: string;
  shopDomain: string;
  shopName: string;
  primaryDomain: string;
  encryptedAccessToken: string;
  scopes: string;
  status: string;
  lastSyncedAt: Date | null;
  lastSyncStatus: string;
  lastSyncError: string | null;
  productCount: number;
  connectedAt: Date;
  updatedAt: Date;
}): ShopifyConnectionRecord {
  return {
    ...row,
    lastSyncStatus: asShopifySyncStatus(row.lastSyncStatus),
  };
}

function mapShopifyProduct(row: {
  id: string;
  workspaceId: string;
  shopifyProductId: string;
  handle: string;
  title: string;
  description: string;
  status: string;
  productType: string;
  vendor: string;
  tags: string;
  url: string;
  imageUrls: unknown;
  variants: unknown;
  publishedAt: Date | null;
  shopifyUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ShopifyProductRecord {
  return {
    ...row,
    imageUrls: asStringList(row.imageUrls),
    variants: asShopifyVariants(row.variants),
  };
}

function mapGoogleCalendarConnection(row: GoogleCalendarConnectionRecord): GoogleCalendarConnectionRecord {
  return row;
}

function mapCalendarSettings(row: {
  id: string;
  workspaceId: string;
  durationMinutes: number;
  availableDays: unknown;
  startMinutes: number;
  endMinutes: number;
  timezone: string;
  minNoticeMinutes: number;
  bufferMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}): CalendarBookingSettingsRecord {
  return {
    ...row,
    availableDays: assertWeekdayList(row.availableDays),
  };
}

function mapCalendarSession(row: {
  id: string;
  workspaceId: string;
  conversationId: string;
  customerName: string;
  email: string;
  service: string;
  offeredSlots: unknown;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): CalendarBookingSessionRecord {
  const status = row.status === "offering" || row.status === "booked" ? row.status : "collecting";
  return {
    ...row,
    status,
    offeredSlots: asCalendarSlots(row.offeredSlots),
  };
}

function asCalendarSlots(value: unknown): CalendarSlot[] {
  if (!Array.isArray(value)) return [];
  const slots: CalendarSlot[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as { start?: unknown; end?: unknown; label?: unknown };
    if (typeof row.start !== "string" || typeof row.end !== "string" || typeof row.label !== "string") continue;
    slots.push({ start: row.start, end: row.end, label: row.label });
  }
  return slots;
}

function mapCalendarAppointment(row: CalendarAppointmentRecord): CalendarAppointmentRecord {
  return row;
}

function mapGmailConnection(row: {
  id: string;
  workspaceId: string;
  googleEmail: string;
  googleSub: string | null;
  encryptedRefreshToken: string;
  encryptedAccessToken: string;
  accessTokenExpiresAt: Date;
  scopes: string;
  status: string;
  connectedAt: Date;
  updatedAt: Date;
}): GmailConnectionRecord {
  return row;
}

function mapGmailReplyDraft(row: {
  id: string;
  workspaceId: string;
  gmailMessageId: string;
  gmailThreadId: string;
  rfcMessageId: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  receivedAt: Date | null;
  draftSubject: string;
  draftBody: string;
  intent: string;
  sources: unknown;
  operatorNote: string;
  usedInternalKnowledge: boolean;
  status: string;
  sentAt: Date | null;
  sendLockAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): GmailReplyDraftRecord {
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

function mapConversation(row: {
  id: string;
  workspaceId: string;
  visitorKey: string;
  waitingOnHuman: boolean;
  visitorName: string;
  visitorEmail: string;
  visitorPhone: string;
  channel: string;
  customerIntent: string;
  inboxStatus: string;
  ownerLastReadAt: Date | null;
  lastMessageAt: Date;
  aiSummary: string;
  detectedLanguage: string;
  createdAt: Date;
}): ConversationRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    visitorKey: row.visitorKey,
    waitingOnHuman: row.waitingOnHuman,
    visitorName: row.visitorName,
    visitorEmail: row.visitorEmail,
    visitorPhone: row.visitorPhone,
    channel: parseConversationChannel(row.channel),
    customerIntent: parseCustomerIntent(row.customerIntent),
    inboxStatus: parseInboxStatus(row.inboxStatus),
    ownerLastReadAt: row.ownerLastReadAt,
    lastMessageAt: row.lastMessageAt,
    aiSummary: row.aiSummary,
    detectedLanguage: row.detectedLanguage,
    createdAt: row.createdAt,
  };
}

function mapNotification(row: {
  id: string;
  userId: string;
  workspaceId: string;
  type: string;
  message: string;
  relatedType: string;
  relatedId: string;
  createdAt: Date;
  readAt: Date | null;
}): NotificationRecord {
  return row as NotificationRecord;
}

function mapKnowledgeEntry(row: {
  id: string;
  workspaceId: string;
  kind: string;
  title: string;
  content: string;
  enabled: boolean;
  sourceType: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceRef: string;
  lastUpdatedAt: Date;
  createdAt: Date;
}): KnowledgeEntryRecord {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind as KnowledgeEntryRecord["kind"],
    title: row.title,
    content: row.content,
    enabled: row.enabled,
    sourceType: row.sourceType as KnowledgeEntryRecord["sourceType"],
    sourceUrl: row.sourceUrl,
    sourceLabel: row.sourceLabel,
    sourceRef: row.sourceRef,
    lastUpdatedAt: row.lastUpdatedAt,
    createdAt: row.createdAt,
  };
}

function mapLeadRow(row: {
  id: string;
  workspaceId: string;
  conversationId: string | null;
  name: string;
  email: string;
  phone: string;
  interest: string;
  request: string;
  notes: string;
  source: string;
  status: string;
  intent: string;
  aiSummary: string;
  createdAt: Date;
  updatedAt: Date;
}): LeadRecord {
  return {
    ...row,
    status: row.status as LeadRecord["status"],
    intent: parseCustomerIntent(row.intent),
  };
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

  async updateUserPassword(id: string, passwordHash: string) {
    const row = await this.prisma().user.update({
      where: { id },
      data: { passwordHash },
    });
    return mapUser(row);
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
    relatedType?: string;
    relatedId?: string;
  }) {
    const row = await this.prisma().notification.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        type: input.type,
        message: input.message,
        relatedType: input.relatedType ?? "",
        relatedId: input.relatedId ?? "",
      },
    });
    return mapNotification(row);
  }

  async listNotifications(userId: string, workspaceId: string) {
    const rows = await this.prisma().notification.findMany({
      where: { userId, workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapNotification);
  }

  async markNotificationRead(id: string, userId: string, workspaceId: string, now = new Date()) {
    const existing = await this.prisma().notification.findFirst({
      where: { id, userId, workspaceId },
    });
    if (!existing) throw new Error("notification_missing");
    const row = await this.prisma().notification.update({
      where: { id },
      data: { readAt: now },
    });
    return mapNotification(row);
  }

  async createConversation(input: { workspaceId: string; visitorKey: string }) {
    const now = new Date();
    const row = await this.prisma().conversation.create({
      data: { workspaceId: input.workspaceId, visitorKey: input.visitorKey, lastMessageAt: now },
    });
    return mapConversation(row);
  }

  async getConversation(id: string, workspaceId: string) {
    const row = await this.prisma().conversation.findFirst({
      where: { id, workspaceId },
    });
    return row ? mapConversation(row) : null;
  }

  async getConversationForVisitor(
    workspaceId: string,
    visitorKey: string,
    conversationId?: string,
  ) {
    if (conversationId) {
      const row = await this.prisma().conversation.findFirst({
        where: { id: conversationId, workspaceId, visitorKey },
      });
      return row ? mapConversation(row) : null;
    }
    const row = await this.prisma().conversation.findFirst({
      where: { workspaceId, visitorKey },
      orderBy: { createdAt: "desc" },
    });
    return row ? mapConversation(row) : null;
  }

  async listConversations(workspaceId: string) {
    const rows = await this.prisma().conversation.findMany({
      where: { workspaceId },
      orderBy: { lastMessageAt: "desc" },
    });
    return rows.map(mapConversation);
  }

  async countWaitingConversations(workspaceId: string) {
    return this.prisma().conversation.count({
      where: { workspaceId, waitingOnHuman: true },
    });
  }

  async setConversationWaiting(id: string, workspaceId: string, waiting: boolean) {
    const existing = await this.getConversation(id, workspaceId);
    if (!existing) throw new Error("conversation_missing");
    const row = await this.prisma().conversation.update({
      where: { id },
      data: { waitingOnHuman: waiting },
    });
    return mapConversation(row);
  }

  async updateConversation(id: string, workspaceId: string, patch: ConversationV2Patch) {
    const existing = await this.getConversation(id, workspaceId);
    if (!existing) throw new Error("conversation_missing");
    const next = applyConversationPatch(existing, patch);
    const row = await this.prisma().conversation.update({
      where: { id },
      data: {
        visitorName: next.visitorName,
        visitorEmail: next.visitorEmail,
        visitorPhone: next.visitorPhone,
        channel: next.channel,
        customerIntent: next.customerIntent,
        inboxStatus: next.inboxStatus,
        ownerLastReadAt: next.ownerLastReadAt,
        aiSummary: next.aiSummary,
        detectedLanguage: next.detectedLanguage,
        waitingOnHuman: next.waitingOnHuman,
      },
    });
    return mapConversation(row);
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
    const row = await this.prisma().message.create({
      data: {
        workspaceId: input.workspaceId,
        conversationId: input.conversationId,
        role: input.role,
        content: input.content,
        usageCounted: input.usageCounted,
        sources: input.sources === undefined ? undefined : (input.sources as Prisma.InputJsonValue),
        createdAt,
      },
    });
    await this.prisma().conversation.update({
      where: { id: input.conversationId },
      data: { lastMessageAt: createdAt },
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

  async listEmailDrafts(workspaceId: string, widgetKey: string) {
    const rows = await this.prisma().emailDraft.findMany({
      where: { workspaceId, widgetKey },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapEmailDraft);
  }

  async getEmailDraft(id: string, workspaceId: string, widgetKey: string) {
    const row = await this.prisma().emailDraft.findFirst({
      where: { id, workspaceId, widgetKey },
    });
    return row ? mapEmailDraft(row) : null;
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
    const row = await this.prisma().emailDraft.create({
      data: {
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
        sources:
          input.sources === undefined || input.sources === null
            ? undefined
            : (input.sources as unknown as Prisma.InputJsonValue),
        operatorNote: input.operatorNote,
        usedInternalKnowledge: input.usedInternalKnowledge,
      },
    });
    return mapEmailDraft(row);
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
    const existing = await this.getEmailDraft(id, workspaceId, widgetKey);
    if (!existing) throw new Error("email_missing");
    const row = await this.prisma().emailDraft.update({
      where: { id },
      data: {
        ...(patch.draftBody !== undefined ? { draftBody: patch.draftBody } : {}),
        ...(patch.draftSubject !== undefined ? { draftSubject: patch.draftSubject } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.sentAt !== undefined ? { sentAt: patch.sentAt } : {}),
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
    return mapEmailDraft(row);
  }

  async getGmailConnection(workspaceId: string) {
    const row = await this.prisma().gmailConnection.findUnique({ where: { workspaceId } });
    return row ? mapGmailConnection(row) : null;
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
    const row = await this.prisma().gmailConnection.upsert({
      where: { workspaceId: input.workspaceId },
      create: {
        workspaceId: input.workspaceId,
        googleEmail: input.googleEmail,
        googleSub: input.googleSub ?? null,
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptedAccessToken: input.encryptedAccessToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        scopes: input.scopes,
        status: input.status,
      },
      update: {
        googleEmail: input.googleEmail,
        googleSub: input.googleSub ?? null,
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptedAccessToken: input.encryptedAccessToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        scopes: input.scopes,
        status: input.status,
      },
    });
    return mapGmailConnection(row);
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
    const existing = await this.getGmailConnection(workspaceId);
    if (!existing) throw new Error("gmail_missing");
    const row = await this.prisma().gmailConnection.update({
      where: { workspaceId },
      data: {
        ...(patch.googleEmail !== undefined ? { googleEmail: patch.googleEmail } : {}),
        ...(patch.googleSub !== undefined ? { googleSub: patch.googleSub } : {}),
        ...(patch.encryptedRefreshToken !== undefined
          ? { encryptedRefreshToken: patch.encryptedRefreshToken }
          : {}),
        ...(patch.encryptedAccessToken !== undefined
          ? { encryptedAccessToken: patch.encryptedAccessToken }
          : {}),
        ...(patch.accessTokenExpiresAt !== undefined
          ? { accessTokenExpiresAt: patch.accessTokenExpiresAt }
          : {}),
        ...(patch.scopes !== undefined ? { scopes: patch.scopes } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
      },
    });
    return mapGmailConnection(row);
  }

  async deleteGmailConnection(workspaceId: string) {
    await this.prisma().gmailReplyDraft.deleteMany({ where: { workspaceId } });
    await this.prisma().gmailConnection.deleteMany({ where: { workspaceId } });
  }

  async getGmailReplyDraft(workspaceId: string, gmailMessageId: string) {
    const row = await this.prisma().gmailReplyDraft.findUnique({
      where: { workspaceId_gmailMessageId: { workspaceId, gmailMessageId } },
    });
    return row ? mapGmailReplyDraft(row) : null;
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
    const existing = await this.getGmailReplyDraft(input.workspaceId, input.gmailMessageId);
    const sources =
      input.sources === undefined || input.sources === null
        ? Prisma.JsonNull
        : (input.sources as unknown as Prisma.InputJsonValue);
    if (existing) {
      const row = await this.prisma().gmailReplyDraft.update({
        where: { id: existing.id },
        data: {
          gmailThreadId: input.gmailThreadId,
          rfcMessageId: input.rfcMessageId ?? existing.rfcMessageId,
          fromName: input.fromName,
          fromEmail: input.fromEmail,
          subject: input.subject,
          body: input.body,
          receivedAt: input.receivedAt ?? existing.receivedAt,
          ...(existing.status === "sent"
            ? {}
            : {
                draftSubject: input.draftSubject,
                draftBody: input.draftBody,
                intent: input.intent,
                sources,
                operatorNote: input.operatorNote,
                usedInternalKnowledge: input.usedInternalKnowledge,
                status: input.status,
              }),
        },
      });
      return mapGmailReplyDraft(row);
    }
    const row = await this.prisma().gmailReplyDraft.create({
      data: {
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
        sources: input.sources === undefined || input.sources === null ? undefined : sources,
        operatorNote: input.operatorNote,
        usedInternalKnowledge: input.usedInternalKnowledge,
        status: input.status,
      },
    });
    return mapGmailReplyDraft(row);
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
    const existing = await this.getGmailReplyDraft(workspaceId, gmailMessageId);
    if (!existing) throw new Error("gmail_draft_missing");
    const row = await this.prisma().gmailReplyDraft.update({
      where: { id: existing.id },
      data: {
        ...(patch.draftSubject !== undefined ? { draftSubject: patch.draftSubject } : {}),
        ...(patch.draftBody !== undefined ? { draftBody: patch.draftBody } : {}),
        ...(patch.intent !== undefined ? { intent: patch.intent } : {}),
        ...(patch.sources !== undefined
          ? { sources: (patch.sources ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue }
          : {}),
        ...(patch.operatorNote !== undefined ? { operatorNote: patch.operatorNote } : {}),
        ...(patch.usedInternalKnowledge !== undefined
          ? { usedInternalKnowledge: patch.usedInternalKnowledge }
          : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.sentAt !== undefined ? { sentAt: patch.sentAt } : {}),
        ...(patch.sendLockAt !== undefined ? { sendLockAt: patch.sendLockAt } : {}),
        ...(patch.rfcMessageId !== undefined ? { rfcMessageId: patch.rfcMessageId } : {}),
        ...(patch.gmailThreadId !== undefined ? { gmailThreadId: patch.gmailThreadId } : {}),
        ...(patch.fromName !== undefined ? { fromName: patch.fromName } : {}),
        ...(patch.fromEmail !== undefined ? { fromEmail: patch.fromEmail } : {}),
        ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
        ...(patch.body !== undefined ? { body: patch.body } : {}),
        ...(patch.receivedAt !== undefined ? { receivedAt: patch.receivedAt } : {}),
      },
    });
    return mapGmailReplyDraft(row);
  }

  async claimGmailReplySend(workspaceId: string, gmailMessageId: string, now = new Date()) {
    const existing = await this.getGmailReplyDraft(workspaceId, gmailMessageId);
    if (!existing) throw new Error("gmail_draft_missing");
    if (existing.status === "sent") throw new Error("gmail_already_sent");
    if (existing.sendLockAt && now.getTime() - existing.sendLockAt.getTime() < 120_000) {
      throw new Error("gmail_send_in_progress");
    }
    const row = await this.prisma().gmailReplyDraft.update({
      where: { id: existing.id },
      data: { sendLockAt: now },
    });
    return mapGmailReplyDraft(row);
  }

  async getShopifyConnection(workspaceId: string) {
    const row = await this.prisma().shopifyConnection.findUnique({ where: { workspaceId } });
    return row ? mapShopifyConnection(row) : null;
  }

  async getShopifyConnectionByShop(shopDomain: string) {
    const row = await this.prisma().shopifyConnection.findUnique({ where: { shopDomain } });
    return row ? mapShopifyConnection(row) : null;
  }

  async upsertShopifyConnection(input: ShopifyConnectionWrite) {
    const row = await this.prisma().shopifyConnection.upsert({
      where: { workspaceId: input.workspaceId },
      create: {
        workspaceId: input.workspaceId,
        shopDomain: input.shopDomain,
        shopName: input.shopName ?? "",
        primaryDomain: input.primaryDomain ?? "",
        encryptedAccessToken: input.encryptedAccessToken,
        scopes: input.scopes,
        status: input.status,
        lastSyncedAt: input.lastSyncedAt ?? null,
        lastSyncStatus: input.lastSyncStatus ?? "idle",
        lastSyncError: input.lastSyncError ?? null,
        productCount: input.productCount ?? 0,
      },
      update: {
        shopDomain: input.shopDomain,
        shopName: input.shopName ?? undefined,
        primaryDomain: input.primaryDomain ?? undefined,
        encryptedAccessToken: input.encryptedAccessToken,
        scopes: input.scopes,
        status: input.status,
        ...(input.lastSyncedAt !== undefined ? { lastSyncedAt: input.lastSyncedAt } : {}),
        ...(input.lastSyncStatus !== undefined ? { lastSyncStatus: input.lastSyncStatus } : {}),
        ...(input.lastSyncError !== undefined ? { lastSyncError: input.lastSyncError } : {}),
        ...(input.productCount !== undefined ? { productCount: input.productCount } : {}),
      },
    });
    return mapShopifyConnection(row);
  }

  async updateShopifyConnection(
    workspaceId: string,
    patch: Partial<
      Omit<ShopifyConnectionRecord, "id" | "workspaceId" | "connectedAt" | "updatedAt" | "encryptedAccessToken">
    > & { encryptedAccessToken?: string },
  ) {
    const existing = await this.getShopifyConnection(workspaceId);
    if (!existing) throw new Error("shopify_missing");
    const row = await this.prisma().shopifyConnection.update({
      where: { workspaceId },
      data: {
        ...(patch.shopDomain !== undefined ? { shopDomain: patch.shopDomain } : {}),
        ...(patch.shopName !== undefined ? { shopName: patch.shopName } : {}),
        ...(patch.primaryDomain !== undefined ? { primaryDomain: patch.primaryDomain } : {}),
        ...(patch.encryptedAccessToken !== undefined
          ? { encryptedAccessToken: patch.encryptedAccessToken }
          : {}),
        ...(patch.scopes !== undefined ? { scopes: patch.scopes } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.lastSyncedAt !== undefined ? { lastSyncedAt: patch.lastSyncedAt } : {}),
        ...(patch.lastSyncStatus !== undefined ? { lastSyncStatus: patch.lastSyncStatus } : {}),
        ...(patch.lastSyncError !== undefined ? { lastSyncError: patch.lastSyncError } : {}),
        ...(patch.productCount !== undefined ? { productCount: patch.productCount } : {}),
      },
    });
    return mapShopifyConnection(row);
  }

  async deleteShopifyConnection(workspaceId: string) {
    await this.prisma().shopifyProduct.deleteMany({ where: { workspaceId } });
    await this.prisma().shopifyConnection.deleteMany({ where: { workspaceId } });
  }

  async listShopifyProducts(workspaceId: string) {
    const rows = await this.prisma().shopifyProduct.findMany({
      where: { workspaceId },
      orderBy: { title: "asc" },
    });
    return rows.map(mapShopifyProduct);
  }

  async replaceShopifyProducts(workspaceId: string, products: ShopifyProductWrite[]) {
    const scoped = products.filter((row) => row.workspaceId === workspaceId);
    const prisma = this.prisma();
    await prisma.$transaction(async (tx) => {
      await tx.shopifyProduct.deleteMany({ where: { workspaceId } });
      if (!scoped.length) return;
      await tx.shopifyProduct.createMany({
        data: scoped.map((row) => ({
          workspaceId,
          shopifyProductId: row.shopifyProductId,
          handle: row.handle,
          title: row.title,
          description: row.description,
          status: row.status,
          productType: row.productType,
          vendor: row.vendor,
          tags: row.tags,
          url: row.url,
          imageUrls: row.imageUrls as unknown as Prisma.InputJsonValue,
          variants: row.variants as unknown as Prisma.InputJsonValue,
          publishedAt: row.publishedAt,
          shopifyUpdatedAt: row.shopifyUpdatedAt,
        })),
      });
    });
    return this.listShopifyProducts(workspaceId);
  }

  private async assertOwnedConversation(workspaceId: string, conversationId?: string | null) {
    if (!conversationId) return;
    const conversation = await this.getConversation(conversationId, workspaceId);
    if (!conversation) throw new Error("conversation_missing");
  }

  private async assertOwnedLead(workspaceId: string, leadId?: string | null) {
    if (!leadId) return;
    const lead = await this.prisma().lead.findFirst({ where: { id: leadId, workspaceId } });
    if (!lead) throw new Error("lead_missing");
  }

  async listKnowledgeEntries(workspaceId: string, filters?: KnowledgeEntryFilters) {
    const rows = await this.prisma().knowledgeEntry.findMany({
      where: {
        workspaceId,
        ...(filters?.kind ? { kind: filters.kind } : {}),
        ...(filters?.enabled === undefined ? {} : { enabled: filters.enabled }),
      },
      orderBy: { lastUpdatedAt: "desc" },
    });
    const query = filters?.query ?? "";
    return rows.map(mapKnowledgeEntry).filter((row) => knowledgeEntryMatchesQuery(row.title, row.content, query));
  }

  async getKnowledgeEntry(id: string, workspaceId: string) {
    const row = await this.prisma().knowledgeEntry.findFirst({ where: { id, workspaceId } });
    return row ? mapKnowledgeEntry(row) : null;
  }

  async createKnowledgeEntry(workspaceId: string, input: KnowledgeEntryInput) {
    const draft = newKnowledgeEntry(workspaceId, input);
    const row = await this.prisma().knowledgeEntry.create({
      data: {
        workspaceId,
        kind: draft.kind,
        title: draft.title,
        content: draft.content,
        enabled: draft.enabled,
        sourceType: draft.sourceType,
        sourceUrl: draft.sourceUrl,
        sourceLabel: draft.sourceLabel,
        sourceRef: draft.sourceRef,
      },
    });
    return mapKnowledgeEntry(row);
  }

  async updateKnowledgeEntry(id: string, workspaceId: string, patch: Partial<KnowledgeEntryInput>) {
    const current = await this.getKnowledgeEntry(id, workspaceId);
    if (!current) throw new Error("knowledge_entry_missing");
    const next = patchKnowledgeEntry(current, patch);
    const row = await this.prisma().knowledgeEntry.update({
      where: { id },
      data: {
        kind: next.kind,
        title: next.title,
        content: next.content,
        enabled: next.enabled,
        sourceType: next.sourceType,
        sourceUrl: next.sourceUrl,
        sourceLabel: next.sourceLabel,
        sourceRef: next.sourceRef,
      },
    });
    return mapKnowledgeEntry(row);
  }

  async deleteKnowledgeEntry(id: string, workspaceId: string) {
    const current = await this.getKnowledgeEntry(id, workspaceId);
    if (!current) throw new Error("knowledge_entry_missing");
    await this.prisma().knowledgeEntry.delete({ where: { id } });
  }

  async listUnansweredQuestions(workspaceId: string) {
    const rows = await this.prisma().unansweredQuestion.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      ...row,
      status: requireUnansweredStatus(row.status),
    }));
  }

  async createUnansweredQuestion(input: {
    workspaceId: string;
    conversationId?: string | null;
    question: string;
    detectedLanguage?: string;
  }) {
    await this.assertOwnedConversation(input.workspaceId, input.conversationId);
    const draft = newUnansweredQuestion(input);
    const row = await this.prisma().unansweredQuestion.create({
      data: {
        workspaceId: draft.workspaceId,
        conversationId: draft.conversationId,
        question: draft.question,
        detectedLanguage: draft.detectedLanguage,
        status: draft.status,
      },
    });
    return { ...row, status: requireUnansweredStatus(row.status) };
  }

  async updateUnansweredQuestion(
    id: string,
    workspaceId: string,
    patch: Partial<Pick<UnansweredQuestionRecord, "status" | "resolvedAt">>,
  ) {
    const existing = await this.prisma().unansweredQuestion.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error("unanswered_question_missing");
    const status = patch.status ? requireUnansweredStatus(patch.status) : requireUnansweredStatus(existing.status);
    const resolvedAt =
      patch.resolvedAt !== undefined
        ? patch.resolvedAt
        : status !== "open" && !existing.resolvedAt
          ? new Date()
          : existing.resolvedAt;
    const row = await this.prisma().unansweredQuestion.update({
      where: { id },
      data: { status, resolvedAt },
    });
    return { ...row, status: requireUnansweredStatus(row.status) };
  }

  async listLeads(workspaceId: string) {
    const rows = await this.prisma().lead.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapLeadRow);
  }

  async getLead(id: string, workspaceId: string) {
    const row = await this.prisma().lead.findFirst({ where: { id, workspaceId } });
    return row ? mapLeadRow(row) : null;
  }

  async createLead(workspaceId: string, input: LeadInput = {}) {
    await this.assertOwnedConversation(workspaceId, input.conversationId);
    const draft = newLead(workspaceId, input);
    const row = await this.prisma().lead.create({
      data: {
        workspaceId,
        conversationId: draft.conversationId,
        name: draft.name,
        email: draft.email,
        phone: draft.phone,
        interest: draft.interest,
        request: draft.request,
        notes: draft.notes,
        source: draft.source,
        status: draft.status,
        intent: draft.intent,
        aiSummary: draft.aiSummary,
      },
    });
    return {
      ...row,
      status: draft.status,
      intent: draft.intent,
    };
  }

  async updateLead(id: string, workspaceId: string, patch: LeadInput) {
    const current = await this.getLead(id, workspaceId);
    if (!current) throw new Error("lead_missing");
    await this.assertOwnedConversation(workspaceId, patch.conversationId);
    const next = patchLead(current, patch);
    const row = await this.prisma().lead.update({
      where: { id },
      data: {
        conversationId: next.conversationId,
        name: next.name,
        email: next.email,
        phone: next.phone,
        interest: next.interest,
        request: next.request,
        notes: next.notes,
        source: next.source,
        status: next.status,
        intent: next.intent,
        aiSummary: next.aiSummary,
      },
    });
    return { ...row, status: next.status, intent: next.intent };
  }

  async listQuoteRequests(workspaceId: string) {
    const rows = await this.prisma().quoteRequest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({ ...row, status: requireQuoteStatus(row.status) }));
  }

  async createQuoteRequest(workspaceId: string, input: QuoteRequestWrite = {}) {
    await this.assertOwnedConversation(workspaceId, input.conversationId);
    await this.assertOwnedLead(workspaceId, input.leadId);
    const draft = newQuoteRequest(workspaceId, input);
    const row = await this.prisma().quoteRequest.create({
      data: {
        workspaceId,
        conversationId: draft.conversationId,
        leadId: draft.leadId,
        customerName: draft.customerName,
        email: draft.email,
        phone: draft.phone,
        productService: draft.productService,
        requirements: draft.requirements,
        notes: draft.notes,
        status: draft.status,
      },
    });
    return { ...row, status: draft.status };
  }

  async updateQuoteRequest(id: string, workspaceId: string, patch: QuoteRequestWrite) {
    const existing = await this.prisma().quoteRequest.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error("quote_request_missing");
    if (patch.leadId) await this.assertOwnedLead(workspaceId, patch.leadId);
    const current: QuoteRequestRecord = { ...existing, status: requireQuoteStatus(existing.status) };
    const next = patchQuoteRequest(current, patch);
    const row = await this.prisma().quoteRequest.update({
      where: { id },
      data: {
        conversationId: next.conversationId,
        leadId: next.leadId,
        customerName: next.customerName,
        email: next.email,
        phone: next.phone,
        productService: next.productService,
        requirements: next.requirements,
        notes: next.notes,
        status: next.status,
      },
    });
    return { ...row, status: requireQuoteStatus(row.status) };
  }

  async listAppointmentRequests(workspaceId: string) {
    const rows = await this.prisma().appointmentRequest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({ ...row, status: requireAppointmentStatus(row.status) }));
  }

  async createAppointmentRequest(workspaceId: string, input: AppointmentRequestWrite = {}) {
    await this.assertOwnedConversation(workspaceId, input.conversationId);
    await this.assertOwnedLead(workspaceId, input.leadId);
    const draft = newAppointmentRequest(workspaceId, input);
    const row = await this.prisma().appointmentRequest.create({
      data: {
        workspaceId,
        conversationId: draft.conversationId,
        leadId: draft.leadId,
        customerName: draft.customerName,
        email: draft.email,
        phone: draft.phone,
        requestedService: draft.requestedService,
        preferredAt: draft.preferredAt,
        notes: draft.notes,
        status: draft.status,
      },
    });
    return { ...row, status: draft.status };
  }

  async updateAppointmentRequest(id: string, workspaceId: string, patch: AppointmentRequestWrite) {
    const existing = await this.prisma().appointmentRequest.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new Error("appointment_request_missing");
    if (patch.leadId) await this.assertOwnedLead(workspaceId, patch.leadId);
    const current: AppointmentRequestRecord = {
      ...existing,
      status: requireAppointmentStatus(existing.status),
    };
    const next = patchAppointmentRequest(current, patch);
    const row = await this.prisma().appointmentRequest.update({
      where: { id },
      data: {
        conversationId: next.conversationId,
        leadId: next.leadId,
        customerName: next.customerName,
        email: next.email,
        phone: next.phone,
        requestedService: next.requestedService,
        preferredAt: next.preferredAt,
        notes: next.notes,
        status: next.status,
      },
    });
    return { ...row, status: requireAppointmentStatus(row.status) };
  }

  async getWidgetSettings(workspaceId: string) {
    const row = await this.prisma().widgetSettings.findUnique({ where: { workspaceId } });
    return row ? mapWidgetSettings(row) : null;
  }

  async upsertWidgetSettings(workspaceId: string, patch: WidgetSettingsInput = {}) {
    const current = await this.getWidgetSettings(workspaceId);
    const base = current ?? { id: "pending", ...defaultWidgetSettings(workspaceId) };
    const next = mergeWidgetSettings(base, patch);
    const row = await this.prisma().widgetSettings.upsert({
      where: { workspaceId },
      create: {
        workspaceId,
        businessDisplayName: next.businessDisplayName,
        logoUrl: next.logoUrl,
        welcomeMessage: next.welcomeMessage,
        suggestedQuestions: next.suggestedQuestions,
        accentColor: next.accentColor,
        position: next.position,
        identifyAsAi: next.identifyAsAi,
        collectPhone: next.collectPhone,
        leadCaptureEnabled: next.leadCaptureEnabled,
        placeholderPrompt: next.placeholderPrompt,
      },
      update: {
        businessDisplayName: next.businessDisplayName,
        logoUrl: next.logoUrl,
        welcomeMessage: next.welcomeMessage,
        suggestedQuestions: next.suggestedQuestions,
        accentColor: next.accentColor,
        position: next.position,
        identifyAsAi: next.identifyAsAi,
        collectPhone: next.collectPhone,
        leadCaptureEnabled: next.leadCaptureEnabled,
        placeholderPrompt: next.placeholderPrompt,
      },
    });
    return mapWidgetSettings(row);
  }

  async listIntegrationConnections(workspaceId: string) {
    const rows = await this.prisma().integrationConnection.findMany({ where: { workspaceId } });
    return rows.map((row) => {
      const parsed = newIntegrationConnection({
        workspaceId: row.workspaceId,
        provider: row.provider,
        status: row.status,
      });
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        provider: parsed.provider,
        status: parsed.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  async upsertIntegrationConnection(input: {
    workspaceId: string;
    provider: IntegrationConnectionRecord["provider"];
    status?: IntegrationConnectionRecord["status"];
  }) {
    const draft = newIntegrationConnection(input);
    const row = await this.prisma().integrationConnection.upsert({
      where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: draft.provider } },
      create: {
        workspaceId: input.workspaceId,
        provider: draft.provider,
        status: draft.status,
      },
      update: { status: draft.status },
    });
    return { ...row, provider: draft.provider, status: draft.status };
  }

  async getGoogleCalendarConnection(workspaceId: string) {
    const row = await this.prisma().googleCalendarConnection.findUnique({ where: { workspaceId } });
    return row ? mapGoogleCalendarConnection(row) : null;
  }

  async upsertGoogleCalendarConnection(input: {
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
  }) {
    const row = await this.prisma().googleCalendarConnection.upsert({
      where: { workspaceId: input.workspaceId },
      create: {
        workspaceId: input.workspaceId,
        googleEmail: input.googleEmail,
        googleSub: input.googleSub ?? null,
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptedAccessToken: input.encryptedAccessToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        scopes: input.scopes,
        status: input.status,
        calendarId: input.calendarId,
        calendarSummary: input.calendarSummary,
      },
      update: {
        googleEmail: input.googleEmail,
        googleSub: input.googleSub ?? null,
        encryptedRefreshToken: input.encryptedRefreshToken,
        encryptedAccessToken: input.encryptedAccessToken,
        accessTokenExpiresAt: input.accessTokenExpiresAt,
        scopes: input.scopes,
        status: input.status,
        calendarId: input.calendarId,
        calendarSummary: input.calendarSummary,
      },
    });
    return mapGoogleCalendarConnection(row);
  }

  async updateGoogleCalendarConnection(
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
  ) {
    const existing = await this.getGoogleCalendarConnection(workspaceId);
    if (!existing) throw new BillingError("Google Calendar is not connected.", "not_found");
    const row = await this.prisma().googleCalendarConnection.update({
      where: { workspaceId },
      data: patch,
    });
    return mapGoogleCalendarConnection(row);
  }

  async deleteGoogleCalendarConnection(workspaceId: string) {
    await this.prisma().googleCalendarConnection.deleteMany({ where: { workspaceId } });
  }

  async getCalendarBookingSettings(workspaceId: string) {
    const row = await this.prisma().calendarBookingSettings.findUnique({ where: { workspaceId } });
    return row ? mapCalendarSettings(row) : null;
  }

  async upsertCalendarBookingSettings(input: {
    workspaceId: string;
    durationMinutes: number;
    availableDays: CalendarBookingSettingsRecord["availableDays"];
    startMinutes: number;
    endMinutes: number;
    timezone: string;
    minNoticeMinutes: number;
    bufferMinutes: number;
  }) {
    const availableDays = input.availableDays as Prisma.InputJsonValue;
    const row = await this.prisma().calendarBookingSettings.upsert({
      where: { workspaceId: input.workspaceId },
      create: { ...input, availableDays },
      update: { ...input, availableDays },
    });
    return mapCalendarSettings(row);
  }

  async getCalendarBookingSession(workspaceId: string, conversationId: string) {
    const row = await this.prisma().calendarBookingSession.findUnique({ where: { conversationId } });
    if (!row || row.workspaceId !== workspaceId) return null;
    return mapCalendarSession(row);
  }

  async upsertCalendarBookingSession(input: {
    workspaceId: string;
    conversationId: string;
    customerName: string;
    email: string;
    service: string;
    offeredSlots: CalendarSlot[];
    status: CalendarBookingSessionRecord["status"];
  }) {
    const existing = await this.prisma().calendarBookingSession.findUnique({
      where: { conversationId: input.conversationId },
    });
    if (existing && existing.workspaceId !== input.workspaceId) {
      throw new BillingError("Calendar session belongs to another workspace.", "forbidden");
    }
    const offeredSlots = input.offeredSlots as Prisma.InputJsonValue;
    const row = await this.prisma().calendarBookingSession.upsert({
      where: { conversationId: input.conversationId },
      create: { ...input, offeredSlots },
      update: { ...input, offeredSlots },
    });
    return mapCalendarSession(row);
  }

  async listCalendarAppointments(workspaceId: string) {
    const rows = await this.prisma().calendarAppointment.findMany({
      where: { workspaceId },
      orderBy: { startsAt: "asc" },
    });
    return rows.map(mapCalendarAppointment);
  }

  async createCalendarAppointment(input: {
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
  }) {
    try {
      const row = await this.prisma().calendarAppointment.create({
        data: {
          workspaceId: input.workspaceId,
          conversationId: input.conversationId ?? null,
          customerName: input.customerName,
          email: input.email,
          service: input.service,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: input.timezone,
          googleCalendarId: input.googleCalendarId,
          holdKey: input.holdKey,
          status: "confirmed",
        },
      });
      return mapCalendarAppointment(row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BillingError("That time is already booked.", "conflict");
      }
      throw error;
    }
  }

  async updateCalendarAppointment(
    id: string,
    workspaceId: string,
    patch: Partial<Pick<CalendarAppointmentRecord, "googleEventId" | "status">>,
  ) {
    const existing = await this.prisma().calendarAppointment.findFirst({ where: { id, workspaceId } });
    if (!existing) throw new BillingError("Appointment not found.", "not_found");
    const row = await this.prisma().calendarAppointment.update({
      where: { id },
      data: patch,
    });
    return mapCalendarAppointment(row);
  }

  async claimCalendarConfirmation(id: string, workspaceId: string, now = new Date()) {
    const claimed = await this.prisma().calendarAppointment.updateMany({
      where: {
        id,
        workspaceId,
        confirmationSentAt: null,
        NOT: { googleEventId: "" },
      },
      data: { confirmationSentAt: now },
    });
    if (claimed.count !== 1) return null;
    const row = await this.prisma().calendarAppointment.findFirst({ where: { id, workspaceId } });
    return row ? mapCalendarAppointment(row) : null;
  }

  async releaseCalendarConfirmation(id: string, workspaceId: string) {
    await this.prisma().calendarAppointment.updateMany({
      where: { id, workspaceId },
      data: { confirmationSentAt: null },
    });
  }

  async deleteCalendarAppointment(id: string, workspaceId: string) {
    await this.prisma().calendarAppointment.deleteMany({ where: { id, workspaceId } });
  }
}
