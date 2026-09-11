import type { KnowledgeBase, ReplySource } from "@/lib/types";
import type { WebsiteReplySource } from "@/lib/website/types";

export type MembershipRole = "owner" | "member";

export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"
  | "inactive";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  ownerUserId: string;
  widgetKey: string;
  knowledge: KnowledgeBase | null;
  createdAt: Date;
}

export interface MembershipRecord {
  id: string;
  userId: string;
  workspaceId: string;
  role: MembershipRole;
}

export interface SubscriptionRecord {
  id: string;
  workspaceId: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  canceledAt: Date | null;
  updatedAt: Date;
}

export interface UsagePeriodRecord {
  id: string;
  workspaceId: string;
  subscriptionId: string;
  periodStart: Date;
  periodEnd: Date;
  replyLimit: number;
  repliesUsed: number;
  repliesReserved: number;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  workspaceId: string;
  type: "usage_limit" | "payment_failed" | "canceled" | "activated" | "website_conflict" | "website_sync_error";
  message: string;
  createdAt: Date;
  readAt: Date | null;
}

export interface ConversationRecord {
  id: string;
  workspaceId: string;
  visitorKey: string;
  waitingOnHuman: boolean;
  createdAt: Date;
}

export interface MessageRecord {
  id: string;
  workspaceId: string;
  conversationId: string;
  role: "visitor" | "assistant" | "system";
  content: string;
  usageCounted: boolean;
  sources?: WebsiteReplySource[] | null;
  createdAt: Date;
}

export interface SocialMessageRecord {
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
  sources: ReplySource[] | null;
  operatorNote: string;
  usedInternalKnowledge: boolean;
  postedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StripeEventRecord {
  id: string;
  type: string;
  processedAt: Date;
}

export type StripeLikeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

export class BillingError extends Error {
  constructor(
    message: string,
    readonly code:
      | "unauthorized"
      | "forbidden"
      | "not_found"
      | "inactive"
      | "limit"
      | "conflict"
      | "invalid"
      | "misconfigured",
  ) {
    super(message);
    this.name = "BillingError";
  }
}
