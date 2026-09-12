import { chatAutoDecision, freezeVisitorText } from "@/lib/chat-auto";
import { BIZPILOT_PRO, isPaidAccessStatus } from "@/lib/plan";
import type { KnowledgeBase } from "@/lib/types";
import { groundedWebsiteAnswer } from "@/lib/website/answer";
import type { WebsitePageRecord, WebsiteReplySource } from "@/lib/website/types";
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
    generate: (
      knowledge: KnowledgeBase | null,
      question: string,
      pages?: WebsitePageRecord[],
    ) => Promise<string>;
  }) {
    const now = options.now ?? new Date();
    const workspace = await this.store.getWorkspaceByWidgetKey(options.widgetKey);
    if (!workspace) throw new BillingError("Unknown website widget.", "not_found");
    const subscription = await this.store.getSubscriptionByWorkspace(workspace.id);
    if (!hasPaidDashboardAccess(subscription, now)) {
      throw new BillingError("This business’s BizPilot Pro subscription is not active.", "inactive");
    }

    if (options.conversationId) {
      const existing = await this.store.getConversationForVisitor(
        workspace.id,
        options.visitorKey,
        options.conversationId,
      );
      if (!existing) throw new BillingError("Conversation not found.", "not_found");
    }

    const thread =
      (await this.store.getConversationForVisitor(
        workspace.id,
        options.visitorKey,
        options.conversationId,
      )) ??
      (await this.store.createConversation({
        workspaceId: workspace.id,
        visitorKey: options.visitorKey,
      }));

    if (thread.waitingOnHuman) {
      await this.store.addMessage({
        workspaceId: workspace.id,
        conversationId: thread.id,
        role: "visitor",
        content: options.question,
        usageCounted: false,
      });
      const handoff =
        workspace.knowledge?.escalation.handoffMessage ||
        "A teammate is on this chat and will reply here. AI replies are paused.";
      await this.store.addMessage({
        workspaceId: workspace.id,
        conversationId: thread.id,
        role: "system",
        content: handoff,
        usageCounted: false,
      });
      return {
        conversationId: thread.id,
        answer: handoff,
        waitingOnHuman: true,
        sources: [],
        usage: null,
      };
    }

    const decision = chatAutoDecision(workspace.knowledge, options.question);
    if (!decision.autoAnswer) {
      await this.store.addMessage({
        workspaceId: workspace.id,
        conversationId: thread.id,
        role: "visitor",
        content: options.question,
        usageCounted: false,
      });
      await this.store.setConversationWaiting(thread.id, workspace.id, true);
      await this.notifyHumanNeeded(workspace.id, subscription!.userId);
      const answer = freezeVisitorText(workspace.knowledge, decision.reply);
      await this.store.addMessage({
        workspaceId: workspace.id,
        conversationId: thread.id,
        role: "assistant",
        content: answer,
        usageCounted: false,
      });
      return {
        conversationId: thread.id,
        answer,
        waitingOnHuman: true,
        sources: [],
        usage: null,
      };
    }

    let gate: Awaited<ReturnType<BillingService["assertWidgetCanReply"]>>;
    try {
      gate = await this.assertWidgetCanReply(options.widgetKey, now);
    } catch (error) {
      if (error instanceof BillingError && error.code === "limit") {
        await this.store.addMessage({
          workspaceId: workspace.id,
          conversationId: thread.id,
          role: "visitor",
          content: options.question,
          usageCounted: false,
        });
        await this.store.setConversationWaiting(thread.id, workspace.id, true);
        await this.notifyLimit(workspace.id, subscription!.userId);
        await this.notifyHumanNeeded(workspace.id, subscription!.userId);
        const handoff =
          workspace.knowledge?.escalation.handoffMessage ||
          "I want to make sure you get a precise answer. I’m looping in a teammate who can take it from here.";
        const answer = `This business has used its monthly AI reply allowance. ${handoff}`;
        await this.store.addMessage({
          workspaceId: workspace.id,
          conversationId: thread.id,
          role: "system",
          content: answer,
          usageCounted: false,
        });
        return {
          conversationId: thread.id,
          answer,
          waitingOnHuman: true,
          sources: [],
          usage: { used: BIZPILOT_PRO.replyLimit, limit: BIZPILOT_PRO.replyLimit, remaining: 0 },
        };
      }
      throw error;
    }

    const pages = await this.store.listWebsitePages(gate.workspace.id, gate.workspace.widgetKey);
    const periodStartMs = gate.period.periodStart.getTime();
    const reserved = await this.store.reserveAiReply(gate.workspace.id, periodStartMs);
    if (!reserved) {
      await this.notifyLimit(gate.workspace.id, gate.subscription.userId);
      throw new BillingError(
        "This business has used all 500 AI replies for the current billing month.",
        "limit",
      );
    }

    await this.store.addMessage({
      workspaceId: gate.workspace.id,
      conversationId: thread.id,
      role: "visitor",
      content: options.question,
      usageCounted: false,
    });

    let answer: string;
    try {
      answer = await options.generate(gate.workspace.knowledge, options.question, pages);
    } catch (error) {
      await this.store.releaseReservedAiReply(gate.workspace.id, periodStartMs);
      throw error;
    }

    const grounded = groundedWebsiteAnswer({
      question: options.question,
      pages,
      workspaceId: gate.workspace.id,
      widgetKey: gate.workspace.widgetKey,
      knowledge: gate.workspace.knowledge,
    });
    const sources: WebsiteReplySource[] = grounded.sources;

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
      conversationId: thread.id,
      role: "assistant",
      content: answer,
      usageCounted: true,
      sources,
    });

    if (committed.repliesUsed >= committed.replyLimit) {
      await this.notifyLimit(gate.workspace.id, gate.subscription.userId);
    }

    return {
      conversationId: thread.id,
      answer,
      waitingOnHuman: false,
      sources,
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
    await this.notifyHumanNeeded(workspace.id, subscription!.userId);
    return conversation;
  }

  async sendOperatorReply(input: {
    workspaceId: string;
    conversationId: string;
    content: string;
  }) {
    const conversation = await this.store.getConversation(input.conversationId, input.workspaceId);
    if (!conversation) throw new BillingError("Conversation not found.", "not_found");
    const trimmed = input.content.trim();
    if (!trimmed) throw new BillingError("Reply is required.", "invalid");
    if (!conversation.waitingOnHuman) {
      await this.store.setConversationWaiting(conversation.id, input.workspaceId, true);
    }
    const message = await this.store.addMessage({
      workspaceId: input.workspaceId,
      conversationId: conversation.id,
      role: "human",
      content: trimmed,
      usageCounted: false,
    });
    return { conversation: { ...conversation, waitingOnHuman: true }, message };
  }

  async resumeAi(workspaceId: string, conversationId: string) {
    const conversation = await this.store.getConversation(conversationId, workspaceId);
    if (!conversation) throw new BillingError("Conversation not found.", "not_found");
    const updated = await this.store.setConversationWaiting(conversationId, workspaceId, false);
    await this.store.addMessage({
      workspaceId,
      conversationId,
      role: "system",
      content: "AI replies are on again for this conversation.",
      usageCounted: false,
    });
    return updated;
  }

  async loadWidgetThread(widgetKey: string, visitorKey: string, conversationId?: string) {
    const workspace = await this.store.getWorkspaceByWidgetKey(widgetKey);
    if (!workspace) throw new BillingError("Unknown website widget.", "not_found");
    const subscription = await this.store.getSubscriptionByWorkspace(workspace.id);
    if (!hasPaidDashboardAccess(subscription)) {
      throw new BillingError("This business’s BizPilot Pro subscription is not active.", "inactive");
    }
    const conversation = await this.store.getConversationForVisitor(
      workspace.id,
      visitorKey,
      conversationId,
    );
    if (!conversation) {
      return { conversation: null, messages: [] as Awaited<ReturnType<BillingStore["listMessages"]>> };
    }
    const messages = await this.store.listMessages(conversation.id, workspace.id);
    return { conversation, messages };
  }

  private async notifyHumanNeeded(workspaceId: string, userId: string) {
    const existing = await this.store.listNotifications(userId, workspaceId);
    if (existing.some((row) => row.type === "human_needed" && !row.readAt)) return;
    await this.store.addNotification({
      userId,
      workspaceId,
      type: "human_needed",
      message:
        "A website visitor asked for a person. Open Inbox to reply in the widget. AI is paused on that conversation until you resume it.",
    });
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
