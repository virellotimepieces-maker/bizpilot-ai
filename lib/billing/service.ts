import { chatAutoDecision, freezeVisitorText } from "@/lib/chat-auto";
import { publicCalendarStatus } from "@/lib/calendar/public";
import { publicGmailStatus } from "@/lib/gmail/public";
import { publicShopifyStatus, shopifyConnectionStatusForRow } from "@/lib/shopify/public";
import { catalogProductSources, retrieveRelevantProducts } from "@/lib/shopify/catalog";
import type { ShopifyProductRecord } from "@/lib/shopify/types";
import { BIZPILOT_PRO, isPaidAccessStatus } from "@/lib/plan";
import type { KnowledgeBase } from "@/lib/types";
import { publishedKnowledgeBase } from "@/lib/v2/published-knowledge";
import { answerLacksPublishedKnowledge, normalizeUnansweredQuestion } from "@/lib/v2/unanswered";
import { defaultWidgetSettings, looksLikeEmail, publicWidgetAppearance } from "@/lib/v2/widget-settings";
import { findLeadForContact, findLeadForConversation, filterLeads } from "@/lib/v2/leads";
import { isHighIntent } from "@/lib/v2/intents";
import {
  extractQuotedProductService,
  filterQuoteRequests,
  findOpenQuoteForConversation,
  isQuoteRequestQuestion,
  quotesForConversation,
  shouldPromoteToQuoteIntent,
} from "@/lib/v2/quotes";
import {
  appointmentsForConversation,
  extractPreferredAt,
  extractRequestedService,
  filterAppointmentRequests,
  findOpenAppointmentForConversation,
  isAppointmentRequestQuestion,
  shouldPromoteToAppointmentIntent,
} from "@/lib/v2/appointments";
import { buildWorkspaceAnalytics } from "@/lib/v2/analytics";
import { FUTURE_INTEGRATION_PROVIDERS } from "@/lib/v2/enums";
import { buildWorkspaceIntegrations } from "@/lib/v2/integrations";
import type { AppointmentRequestWrite, LeadInput, QuoteRequestWrite } from "@/lib/v2/types";
import { resolveConversationLanguage } from "@/lib/i18n/conversation-language";
import { localizeAssistantText, type TranslateFn } from "@/lib/i18n/localize";
import { groundedWebsiteAnswer } from "@/lib/website/answer";
import type { WebsitePageRecord, WebsiteReplySource } from "@/lib/website/types";
import type { BillingStore } from "./store";
import { BillingError, type ConversationRecord, type SubscriptionRecord, type UsagePeriodRecord } from "./types";

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

  async assertPaidWidgetWorkspace(widgetKey: string, now = new Date()) {
    const workspace = await this.store.getWorkspaceByWidgetKey(widgetKey);
    if (!workspace) {
      throw new BillingError("Unknown website widget.", "not_found");
    }
    const subscription = await this.store.getSubscriptionByWorkspace(workspace.id);
    if (!hasPaidDashboardAccess(subscription, now)) {
      throw new BillingError("This business’s BizPilot Pro subscription is not active.", "inactive");
    }
    return { workspace, subscription: subscription! };
  }

  async loadPublicWidgetAppearance(widgetKey: string, now = new Date()) {
    const { workspace } = await this.assertPaidWidgetWorkspace(widgetKey, now);
    const settings = await this.store.getWidgetSettings(workspace.id);
    return publicWidgetAppearance(settings, workspace.name);
  }

  async saveWidgetVisitorContact(options: {
    widgetKey: string;
    visitorKey: string;
    conversationId?: string;
    name?: string;
    email?: string;
    phone?: string;
    now?: Date;
  }) {
    const visitorKey = options.visitorKey.trim();
    if (!visitorKey) throw new BillingError("Missing visitor key.", "invalid");
    const { workspace } = await this.assertPaidWidgetWorkspace(options.widgetKey, options.now);
    const stored = await this.store.getWidgetSettings(workspace.id);
    const settings = stored ?? { id: "default", ...defaultWidgetSettings(workspace.id) };
    if (!settings.leadCaptureEnabled) {
      throw new BillingError("This widget is not collecting visitor contact details.", "forbidden");
    }
    const name = (options.name ?? "").trim().slice(0, 80);
    const email = (options.email ?? "").trim().slice(0, 120);
    const phone = settings.collectPhone ? (options.phone ?? "").trim().slice(0, 32) : "";
    if (email && !looksLikeEmail(email)) {
      throw new BillingError("Enter a valid email address.", "invalid");
    }
    if (!name && !email && !phone) {
      throw new BillingError("Enter a name or email so the team can follow up.", "invalid");
    }
    if (options.conversationId) {
      const existing = await this.store.getConversationForVisitor(
        workspace.id,
        visitorKey,
        options.conversationId,
      );
      if (!existing) throw new BillingError("Conversation not found.", "not_found");
    }
    const thread =
      (await this.store.getConversationForVisitor(
        workspace.id,
        visitorKey,
        options.conversationId,
      )) ??
      (await this.store.createConversation({
        workspaceId: workspace.id,
        visitorKey,
      }));
    const conversation = await this.store.updateConversation(thread.id, workspace.id, {
      visitorName: name || thread.visitorName,
      visitorEmail: email || thread.visitorEmail,
      visitorPhone: phone || thread.visitorPhone,
    });
    await this.upsertLeadFromConversation({
      workspaceId: workspace.id,
      userId: workspace.ownerUserId,
      conversation,
    });
    await this.syncQuoteContactFromConversation({
      workspaceId: workspace.id,
      conversation,
    });
    await this.syncAppointmentContactFromConversation({
      workspaceId: workspace.id,
      conversation,
    });
    return conversation;
  }

  async listWorkspaceLeads(
    workspaceId: string,
    filters: { status?: string | null; query?: string | null } = {},
  ) {
    return filterLeads(await this.store.listLeads(workspaceId), filters);
  }

  async updateWorkspaceLead(workspaceId: string, leadId: string, patch: LeadInput) {
    const current = await this.store.getLead(leadId, workspaceId);
    if (!current) throw new BillingError("Lead not found.", "not_found");
    let next;
    try {
      next = await this.store.updateLead(leadId, workspaceId, patch);
    } catch (error) {
      if (error instanceof Error && error.message === "lead_missing") {
        throw new BillingError("Lead not found.", "not_found");
      }
      throw error;
    }
    if (current.status !== "qualified" && next.status === "qualified") {
      const workspace = await this.store.getWorkspace(workspaceId);
      if (workspace) {
        await this.notifyLeadEvent({
          workspaceId,
          userId: workspace.ownerUserId,
          type: "qualified_lead",
          leadId: next.id,
          message: "A lead was marked qualified. This is an owner status, not a confirmed sale.",
        });
      }
    }
    return next;
  }

  async listWorkspaceQuoteRequests(
    workspaceId: string,
    filters: { status?: string | null; query?: string | null } = {},
  ) {
    return filterQuoteRequests(await this.store.listQuoteRequests(workspaceId), filters);
  }

  async updateWorkspaceQuoteRequest(workspaceId: string, quoteId: string, patch: QuoteRequestWrite) {
    try {
      return await this.store.updateQuoteRequest(quoteId, workspaceId, patch);
    } catch (error) {
      if (error instanceof Error && error.message === "quote_request_missing") {
        throw new BillingError("Quote request not found.", "not_found");
      }
      throw error;
    }
  }

  async listWorkspaceAppointmentRequests(
    workspaceId: string,
    filters: { status?: string | null; query?: string | null } = {},
  ) {
    return filterAppointmentRequests(await this.store.listAppointmentRequests(workspaceId), filters);
  }

  async updateWorkspaceAppointmentRequest(
    workspaceId: string,
    appointmentId: string,
    patch: AppointmentRequestWrite,
  ) {
    try {
      return await this.store.updateAppointmentRequest(appointmentId, workspaceId, patch);
    } catch (error) {
      if (error instanceof Error && error.message === "appointment_request_missing") {
        throw new BillingError("Appointment request not found.", "not_found");
      }
      throw error;
    }
  }

  async loadWorkspaceAnalytics(workspaceId: string, now = new Date()) {
    const workspace = await this.store.getWorkspace(workspaceId);
    if (!workspace) throw new BillingError("Workspace not found.", "not_found");
    const usage = this.usageSnapshot((await this.peekUsage(workspaceId, now)).period);
    const [conversations, leads, quotes, appointments, unanswered, knowledgeEntries, websitePages] =
      await Promise.all([
        this.store.listConversations(workspaceId),
        this.store.listLeads(workspaceId),
        this.store.listQuoteRequests(workspaceId),
        this.store.listAppointmentRequests(workspaceId),
        this.store.listUnansweredQuestions(workspaceId),
        this.store.listKnowledgeEntries(workspaceId),
        this.store.listWebsitePages(workspaceId, workspace.widgetKey),
      ]);
    return buildWorkspaceAnalytics({
      conversations,
      leads,
      quotes,
      appointments,
      unanswered,
      knowledgeEntries,
      websitePages: websitePages.length,
      usage,
    });
  }

  async listWorkspaceIntegrations(workspaceId: string) {
    const workspace = await this.store.getWorkspace(workspaceId);
    if (!workspace) throw new BillingError("Workspace not found.", "not_found");
    const shopifyRow = await this.store.getShopifyConnection(workspaceId);
    for (const provider of FUTURE_INTEGRATION_PROVIDERS) {
      await this.store.upsertIntegrationConnection({
        workspaceId,
        provider,
        status: provider === "shopify" ? shopifyConnectionStatusForRow(shopifyRow) : "disconnected",
      });
    }
    const [gmailRow, calendarRow, connections] = await Promise.all([
      this.store.getGmailConnection(workspaceId),
      this.store.getGoogleCalendarConnection(workspaceId),
      this.store.listIntegrationConnections(workspaceId),
    ]);
    const calendarSettings = calendarRow ? await this.store.getCalendarBookingSettings(workspaceId) : null;
    return buildWorkspaceIntegrations({
      gmail: publicGmailStatus(gmailRow),
      shopify: publicShopifyStatus(shopifyRow),
      calendar: publicCalendarStatus(calendarRow, calendarSettings),
      connections,
    });
  }

  async noteWidgetAppointmentRequest(input: {
    workspaceId: string;
    userId: string;
    conversationId: string;
    question: string;
  }) {
    await this.captureAppointmentRequestIfNeeded(input);
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
      products?: ShopifyProductRecord[],
      language?: string,
    ) => Promise<string>;
    translate?: TranslateFn;
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

    const language = resolveConversationLanguage(thread.detectedLanguage, options.question);
    if (language !== thread.detectedLanguage) {
      await this.store.updateConversation(thread.id, workspace.id, { detectedLanguage: language });
    }

    await this.captureQuoteRequestIfNeeded({
      workspaceId: workspace.id,
      userId: workspace.ownerUserId,
      conversationId: thread.id,
      question: options.question,
    });
    await this.captureAppointmentRequestIfNeeded({
      workspaceId: workspace.id,
      userId: workspace.ownerUserId,
      conversationId: thread.id,
      question: options.question,
    });

    if (thread.waitingOnHuman) {
      await this.store.addMessage({
        workspaceId: workspace.id,
        conversationId: thread.id,
        role: "visitor",
        content: options.question,
        usageCounted: false,
      });
      const handoff = await localizeAssistantText(
        workspace.knowledge?.escalation.handoffMessage ||
          "A teammate is on this chat and will reply here. AI replies are paused.",
        language,
        options.translate,
      );
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

    const entries = await this.store.listKnowledgeEntries(workspace.id);
    const published = publishedKnowledgeBase(workspace.knowledge, entries);
    const decision = chatAutoDecision(published, options.question);
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
      const answer = await localizeAssistantText(
        freezeVisitorText(workspace.knowledge, decision.reply),
        language,
        options.translate,
      );
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
        const answer = await localizeAssistantText(
          `This business has used its monthly AI reply allowance. ${handoff}`,
          language,
          options.translate,
        );
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
    const products = (await this.store.listShopifyProducts(gate.workspace.id)).filter(
      (row) => row.workspaceId === gate.workspace.id,
    );
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
      answer = await options.generate(published, options.question, pages, products, language);
    } catch (error) {
      await this.store.releaseReservedAiReply(gate.workspace.id, periodStartMs);
      throw error;
    }

    const grounded = groundedWebsiteAnswer({
      question: options.question,
      pages,
      workspaceId: gate.workspace.id,
      widgetKey: gate.workspace.widgetKey,
      knowledge: published,
    });
    const sources: WebsiteReplySource[] = [
      ...grounded.sources,
      ...catalogProductSources(retrieveRelevantProducts(products, options.question, gate.workspace.id)),
    ];

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

    await this.recordUnansweredIfNeeded({
      workspaceId: gate.workspace.id,
      userId: gate.subscription.userId,
      conversationId: thread.id,
      question: options.question,
      answer,
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
      content: await localizeAssistantText(
        "A teammate has been asked to take over this conversation.",
        conversation.detectedLanguage,
      ),
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
      content: await localizeAssistantText(
        "AI replies are on again for this conversation.",
        conversation.detectedLanguage,
      ),
      usageCounted: false,
    });
    return updated;
  }

  async loadWidgetThread(
    widgetKey: string,
    visitorKey: string,
    conversationId?: string,
    now = new Date(),
  ) {
    const { workspace } = await this.assertPaidWidgetWorkspace(widgetKey, now);
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

  private async recordUnansweredIfNeeded(input: {
    workspaceId: string;
    userId: string;
    conversationId: string;
    question: string;
    answer: string;
  }) {
    if (!answerLacksPublishedKnowledge(input.answer)) return;
    const open = await this.store.listUnansweredQuestions(input.workspaceId);
    const needle = normalizeUnansweredQuestion(input.question);
    if (open.some((row) => row.status === "open" && normalizeUnansweredQuestion(row.question) === needle)) {
      return;
    }
    const row = await this.store.createUnansweredQuestion({
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      question: input.question.trim(),
    });
    await this.store.addNotification({
      userId: input.userId,
      workspaceId: input.workspaceId,
      type: "unanswered_question",
      message: "A visitor asked something that is not in published Knowledge.",
      relatedType: "unanswered_question",
      relatedId: row.id,
    });
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

  async captureBookingContact(input: {
    workspaceId: string;
    userId: string;
    conversationId?: string | null;
    name?: string;
    email?: string;
  }) {
    const name = (input.name ?? "").trim().slice(0, 80);
    const email = (input.email ?? "").trim().toLowerCase().slice(0, 120);
    if (email && !looksLikeEmail(email)) return null;
    if (!name && !email) return null;
    let conversation: ConversationRecord | null = null;
    if (input.conversationId) {
      const existing = await this.store.getConversation(input.conversationId, input.workspaceId);
      if (existing && existing.workspaceId === input.workspaceId) {
        conversation = await this.store.updateConversation(existing.id, input.workspaceId, {
          visitorName: name || existing.visitorName,
          visitorEmail: email || existing.visitorEmail,
        });
      }
    }
    return this.upsertCapturedLead({
      workspaceId: input.workspaceId,
      userId: input.userId,
      conversationId: conversation?.id ?? null,
      name: conversation?.visitorName || name,
      email: conversation?.visitorEmail || email,
      phone: conversation?.visitorPhone ?? "",
      intent: "appointment_request",
    });
  }

  async syncBookingContactsToLeads(workspaceId: string, userId: string) {
    const appointments = (await this.store.listCalendarAppointments(workspaceId))
      .filter((row) => row.workspaceId === workspaceId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (const row of appointments) {
      await this.captureBookingContact({
        workspaceId,
        userId,
        conversationId: row.conversationId,
        name: row.customerName,
        email: row.email,
      });
    }
  }

  private async upsertLeadFromConversation(input: {
    workspaceId: string;
    userId: string;
    conversation: ConversationRecord;
  }) {
    return this.upsertCapturedLead({
      workspaceId: input.workspaceId,
      userId: input.userId,
      conversationId: input.conversation.id,
      name: input.conversation.visitorName,
      email: input.conversation.visitorEmail,
      phone: input.conversation.visitorPhone,
      intent: input.conversation.customerIntent,
    });
  }

  private async upsertCapturedLead(input: {
    workspaceId: string;
    userId: string;
    conversationId: string | null;
    name: string;
    email: string;
    phone: string;
    intent: ConversationRecord["customerIntent"];
  }) {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (email && !looksLikeEmail(email)) return null;
    if (!name && !email) return null;
    const existing = findLeadForContact(await this.store.listLeads(input.workspaceId), {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId,
      email,
    });
    if (existing) {
      return this.store.updateLead(existing.id, input.workspaceId, {
        name: name || existing.name,
        email: email || existing.email,
        phone: input.phone.trim() || existing.phone,
        conversationId: input.conversationId ?? existing.conversationId,
        intent: existing.intent === "general_question" ? input.intent : existing.intent,
      });
    }
    const lead = await this.store.createLead(input.workspaceId, {
      name,
      email,
      phone: input.phone.trim(),
      conversationId: input.conversationId,
      source: "website",
      intent: input.intent,
      status: "new",
    });
    await this.notifyLeadEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      type: "new_lead",
      leadId: lead.id,
      message: "A website visitor left contact details. Open Leads to review them.",
    });
    if (isHighIntent(lead.intent)) {
      await this.notifyLeadEvent({
        workspaceId: input.workspaceId,
        userId: input.userId,
        type: "high_intent",
        leadId: lead.id,
        message: "A captured lead was stored with a high-intent conversation tag. This is not a confirmed purchase.",
      });
    }
    return lead;
  }

  private async captureQuoteRequestIfNeeded(input: {
    workspaceId: string;
    userId: string;
    conversationId: string;
    question: string;
  }) {
    if (!isQuoteRequestQuestion(input.question)) return;
    const conversation = await this.store.getConversation(input.conversationId, input.workspaceId);
    if (!conversation) return;
    const quotes = await this.store.listQuoteRequests(input.workspaceId);
    const open = findOpenQuoteForConversation(quotes, conversation.id);
    const lead = findLeadForConversation(
      await this.store.listLeads(input.workspaceId),
      conversation.id,
    );
    const requirements = input.question.trim().slice(0, 2000);
    const productService = extractQuotedProductService(input.question);
    const contact = {
      customerName: conversation.visitorName,
      email: conversation.visitorEmail,
      phone: conversation.visitorPhone,
      leadId: lead?.id ?? null,
    };
    if (open) {
      await this.store.updateQuoteRequest(open.id, input.workspaceId, {
        requirements,
        productService: open.productService || productService,
        customerName: contact.customerName || open.customerName,
        email: contact.email || open.email,
        phone: contact.phone || open.phone,
        leadId: contact.leadId ?? open.leadId,
      });
    } else {
      const row = await this.store.createQuoteRequest(input.workspaceId, {
        conversationId: conversation.id,
        ...contact,
        productService,
        requirements,
        status: "requested",
      });
      await this.notifyQuoteRequest({
        workspaceId: input.workspaceId,
        userId: input.userId,
        quoteId: row.id,
      });
    }
    if (shouldPromoteToQuoteIntent(conversation.customerIntent)) {
      await this.store.updateConversation(conversation.id, input.workspaceId, {
        customerIntent: "quote_request",
      });
    }
    if (lead && shouldPromoteToQuoteIntent(lead.intent)) {
      await this.store.updateLead(lead.id, input.workspaceId, {
        intent: "quote_request",
        request: lead.request || requirements,
      });
    }
  }

  private async syncQuoteContactFromConversation(input: {
    workspaceId: string;
    conversation: ConversationRecord;
  }) {
    const quotes = quotesForConversation(
      await this.store.listQuoteRequests(input.workspaceId),
      input.conversation.id,
    );
    if (quotes.length === 0) return;
    const lead = findLeadForConversation(
      await this.store.listLeads(input.workspaceId),
      input.conversation.id,
    );
    for (const row of quotes) {
      await this.store.updateQuoteRequest(row.id, input.workspaceId, {
        customerName: input.conversation.visitorName || row.customerName,
        email: input.conversation.visitorEmail || row.email,
        phone: input.conversation.visitorPhone || row.phone,
        leadId: lead?.id ?? row.leadId,
      });
    }
  }

  private async notifyQuoteRequest(input: { workspaceId: string; userId: string; quoteId: string }) {
    const existing = await this.store.listNotifications(input.userId, input.workspaceId);
    if (
      existing.some(
        (row) => row.type === "quote_request" && row.relatedId === input.quoteId && !row.readAt,
      )
    ) {
      return;
    }
    await this.store.addNotification({
      userId: input.userId,
      workspaceId: input.workspaceId,
      type: "quote_request",
      message:
        "A visitor asked for a quote. This is a request to review — BizPilot did not issue a price or a quote document.",
      relatedType: "quote_request",
      relatedId: input.quoteId,
    });
  }

  private async captureAppointmentRequestIfNeeded(input: {
    workspaceId: string;
    userId: string;
    conversationId: string;
    question: string;
  }) {
    if (!isAppointmentRequestQuestion(input.question)) return;
    const conversation = await this.store.getConversation(input.conversationId, input.workspaceId);
    if (!conversation) return;
    const appointments = await this.store.listAppointmentRequests(input.workspaceId);
    const open = findOpenAppointmentForConversation(appointments, conversation.id);
    const lead = findLeadForConversation(
      await this.store.listLeads(input.workspaceId),
      conversation.id,
    );
    const requestedService =
      extractRequestedService(input.question) || input.question.trim().slice(0, 160);
    const preferredAt = extractPreferredAt(input.question);
    const contact = {
      customerName: conversation.visitorName,
      email: conversation.visitorEmail,
      phone: conversation.visitorPhone,
      leadId: lead?.id ?? null,
    };
    if (open) {
      await this.store.updateAppointmentRequest(open.id, input.workspaceId, {
        requestedService: open.requestedService || requestedService,
        preferredAt: preferredAt || open.preferredAt,
        customerName: contact.customerName || open.customerName,
        email: contact.email || open.email,
        phone: contact.phone || open.phone,
        leadId: contact.leadId ?? open.leadId,
      });
    } else {
      const row = await this.store.createAppointmentRequest(input.workspaceId, {
        conversationId: conversation.id,
        ...contact,
        requestedService,
        preferredAt,
        status: "requested",
      });
      await this.notifyAppointmentRequest({
        workspaceId: input.workspaceId,
        userId: input.userId,
        appointmentId: row.id,
      });
    }
    if (shouldPromoteToAppointmentIntent(conversation.customerIntent)) {
      await this.store.updateConversation(conversation.id, input.workspaceId, {
        customerIntent: "appointment_request",
      });
    }
    if (lead && shouldPromoteToAppointmentIntent(lead.intent)) {
      await this.store.updateLead(lead.id, input.workspaceId, {
        intent: "appointment_request",
        request: lead.request || input.question.trim().slice(0, 2000),
      });
    }
  }

  private async syncAppointmentContactFromConversation(input: {
    workspaceId: string;
    conversation: ConversationRecord;
  }) {
    const appointments = appointmentsForConversation(
      await this.store.listAppointmentRequests(input.workspaceId),
      input.conversation.id,
    );
    if (appointments.length === 0) return;
    const lead = findLeadForConversation(
      await this.store.listLeads(input.workspaceId),
      input.conversation.id,
    );
    for (const row of appointments) {
      await this.store.updateAppointmentRequest(row.id, input.workspaceId, {
        customerName: input.conversation.visitorName || row.customerName,
        email: input.conversation.visitorEmail || row.email,
        phone: input.conversation.visitorPhone || row.phone,
        leadId: lead?.id ?? row.leadId,
      });
    }
  }

  private async notifyAppointmentRequest(input: {
    workspaceId: string;
    userId: string;
    appointmentId: string;
  }) {
    const existing = await this.store.listNotifications(input.userId, input.workspaceId);
    if (
      existing.some(
        (row) =>
          row.type === "appointment_request" && row.relatedId === input.appointmentId && !row.readAt,
      )
    ) {
      return;
    }
    await this.store.addNotification({
      userId: input.userId,
      workspaceId: input.workspaceId,
      type: "appointment_request",
      message:
        "A visitor asked for an appointment. This is a request to review — BizPilot did not confirm a booking or write to a calendar.",
      relatedType: "appointment_request",
      relatedId: input.appointmentId,
    });
  }

  private async notifyLeadEvent(input: {
    workspaceId: string;
    userId: string;
    type: "new_lead" | "qualified_lead" | "high_intent";
    leadId: string;
    message: string;
  }) {
    const existing = await this.store.listNotifications(input.userId, input.workspaceId);
    if (
      existing.some(
        (row) => row.type === input.type && row.relatedId === input.leadId && !row.readAt,
      )
    ) {
      return;
    }
    await this.store.addNotification({
      userId: input.userId,
      workspaceId: input.workspaceId,
      type: input.type,
      message: input.message,
      relatedType: "lead",
      relatedId: input.leadId,
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
