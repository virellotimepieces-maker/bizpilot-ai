import { BIZPILOT_PRO, isPaidAccessStatus } from "@/lib/plan";
import type { KnowledgeBase } from "@/lib/types";
import type { BillingStore } from "./store";
import { BillingError, type SubscriptionRecord, type UsagePeriodRecord } from "./types";

export function hasPaidDashboardAccess(subscription: SubscriptionRecord | null, now = new Date()) {
  if (!subscription) return false;
  if (!isPaidAccessStatus(subscription.status)) return false;
  if (subscription.currentPeriodEnd && subscription.currentPeriodEnd.getTime() < now.getTime()) {
    return false;
  }
  return true;
}

export class BillingService {
  constructor(private readonly store: BillingStore) {}

  async requireMembership(userId: string, workspaceId: string) {
    const membership = await this.store.getMembership(userId, workspaceId);
    if (!membership) {
      throw new BillingError("This workspace is not available to your account.", "forbidden");
    }
    const workspace = await this.store.getWorkspace(workspaceId);
    if (!workspace) {
      throw new BillingError("Workspace not found.", "not_found");
    }
    return { membership, workspace };
  }

  async requirePaidWorkspace(userId: string, workspaceId: string, now = new Date()) {
    const { membership, workspace } = await this.requireMembership(userId, workspaceId);
    const subscription = await this.store.getSubscriptionByWorkspace(workspaceId);
    if (!hasPaidDashboardAccess(subscription, now)) {
      throw new BillingError(
        "BizPilot Pro is not active. Open billing to subscribe or update payment.",
        "inactive",
      );
    }
    return { membership, workspace, subscription: subscription! };
  }

  async peekUsage(workspaceId: string, now = new Date()) {
    const subscription = await this.store.getSubscriptionByWorkspace(workspaceId);
    if (!hasPaidDashboardAccess(subscription, now)) {
      throw new BillingError("Subscription is not active.", "inactive");
    }
    const period = await this.ensureCurrentPeriod(subscription!);
    const remaining = Math.max(0, period.replyLimit - period.repliesUsed - period.repliesReserved);
    return { subscription: subscription!, period, remaining };
  }

  async ensureCurrentPeriod(subscription: SubscriptionRecord) {
    if (!subscription.currentPeriodStart || !subscription.currentPeriodEnd) {
      throw new BillingError("Billing period is missing on the subscription.", "invalid");
    }
    return this.store.ensureUsagePeriod({
      workspaceId: subscription.workspaceId,
      subscriptionId: subscription.id,
      periodStart: subscription.currentPeriodStart,
      periodEnd: subscription.currentPeriodEnd,
      replyLimit: BIZPILOT_PRO.replyLimit,
    });
  }

  async assertWidgetCanReply(widgetKey: string, now = new Date()) {
    const workspace = await this.store.getWorkspaceByWidgetKey(widgetKey);
    if (!workspace) {
      throw new BillingError("Unknown website widget.", "not_found");
    }
    const subscription = await this.store.getSubscriptionByWorkspace(workspace.id);
    if (!hasPaidDashboardAccess(subscription, now)) {
      throw new BillingError("This business’s BizPilot Pro subscription is not active.", "inactive");
    }
    const period = await this.ensureCurrentPeriod(subscription!);
    const remaining = period.replyLimit - period.repliesUsed - period.repliesReserved;
    if (remaining <= 0) {
      throw new BillingError(
        "This business has used all 500 AI replies for the current billing month.",
        "limit",
      );
    }
    return { workspace, subscription: subscription!, period };
  }

  async generateCountedAiReply(options: {
    widgetKey: string;
    visitorKey: string;
    conversationId?: string;
    question: string;
    now?: Date;
    generate: (knowledge: KnowledgeBase | null, question: string) => Promise<string>;
  }) {
    const now = options.now ?? new Date();
    const gate = await this.assertWidgetCanReply(options.widgetKey, now);
    const periodStartMs = gate.period.periodStart.getTime();
    const reserved = await this.store.reserveAiReply(gate.workspace.id, periodStartMs);
    if (!reserved) {
      await this.notifyLimit(gate.workspace.id, gate.subscription.userId);
      throw new BillingError(
        "This business has used all 500 AI replies for the current billing month.",
        "limit",
      );
    }

    const conversation =
      options.conversationId
        ? await this.store.getConversation(options.conversationId, gate.workspace.id)
        : await this.store.createConversation({
            workspaceId: gate.workspace.id,
            visitorKey: options.visitorKey,
          });
    if (!conversation) {
      await this.store.releaseReservedAiReply(gate.workspace.id, periodStartMs);
      throw new BillingError("Conversation not found.", "not_found");
    }

    await this.store.addMessage({
      workspaceId: gate.workspace.id,
      conversationId: conversation.id,
      role: "visitor",
      content: options.question,
      usageCounted: false,
    });

    let answer: string;
    try {
      answer = await options.generate(gate.workspace.knowledge, options.question);
    } catch (error) {
      await this.store.releaseReservedAiReply(gate.workspace.id, periodStartMs);
      throw error;
    }

    const committed = await this.store.commitReservedAiReply(gate.workspace.id, periodStartMs);
    if (!committed) {
      await this.store.releaseReservedAiReply(gate.workspace.id, periodStartMs);
      throw new BillingError(
        "This business has used all 500 AI replies for the current billing month.",
        "limit",
      );
    }

    await this.store.addMessage({
      workspaceId: gate.workspace.id,
      conversationId: conversation.id,
      role: "assistant",
      content: answer,
      usageCounted: true,
    });

    if (committed.repliesUsed >= committed.replyLimit) {
      await this.notifyLimit(gate.workspace.id, gate.subscription.userId);
    }

    return {
      conversationId: conversation.id,
      answer,
      usage: {
        used: committed.repliesUsed,
        limit: committed.replyLimit,
        remaining: Math.max(0, committed.replyLimit - committed.repliesUsed),
      },
    };
  }

  async handoffToHuman(widgetKey: string, conversationId: string, now = new Date()) {
    const workspace = await this.store.getWorkspaceByWidgetKey(widgetKey);
    if (!workspace) throw new BillingError("Unknown website widget.", "not_found");
    const subscription = await this.store.getSubscriptionByWorkspace(workspace.id);
    if (!hasPaidDashboardAccess(subscription, now)) {
      throw new BillingError("Subscription is not active.", "inactive");
    }
    const conversation = await this.store.setConversationWaiting(conversationId, workspace.id, true);
    await this.store.addMessage({
      workspaceId: workspace.id,
      conversationId,
      role: "system",
      content: "A teammate has been asked to take over this conversation.",
      usageCounted: false,
    });
    return conversation;
  }

  private async notifyLimit(workspaceId: string, userId: string) {
    const existing = await this.store.listNotifications(userId, workspaceId);
    if (existing.some((row) => row.type === "usage_limit")) return;
    await this.store.addNotification({
      userId,
      workspaceId,
      type: "usage_limit",
      message:
        "BizPilot Pro has used all 500 AI customer replies for this billing month. The website widget will not generate more AI replies until the next billing period. Visitors are offered a human handoff. There are no overage charges.",
    });
  }

  usageSnapshot(period: UsagePeriodRecord) {
    return {
      used: period.repliesUsed,
      reserved: period.repliesReserved,
      limit: period.replyLimit,
      remaining: Math.max(0, period.replyLimit - period.repliesUsed - period.repliesReserved),
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
    };
  }
}
