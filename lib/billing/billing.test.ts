import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyKnowledge } from "../empty-knowledge";
import { MemoryBillingStore } from "./memory-store";
import { BillingError } from "./types";
import { applyStripeEvent } from "./stripe-events";
import { BillingService, hasPaidDashboardAccess } from "./service";
import { BIZPILOT_PRO } from "../plan";
import type { StripeLikeEvent } from "./types";

const PRICE = "price_test_bizpilot_pro";
const SAFE_QUESTION = "Do you provide website hosting?";

function unix(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

async function seedAccount(store: MemoryBillingStore, name = "Northwind") {
  const user = await store.createUser({
    email: `${name.toLowerCase().replace(/\s+/g, "")}@example.com`,
    passwordHash: "hash",
    name,
  });
  const workspace = await store.createWorkspace({
    ownerUserId: user.id,
    name: `${name} Studio`,
  });
  await store.saveKnowledge(workspace.id, {
    ...emptyKnowledge("custom"),
    name: `${name} Studio`,
    description: "We do not provide hosting unless it is included in the project agreement.",
  });
  return { user, workspace };
}

function checkoutEvent(id: string, userId: string, workspaceId: string): StripeLikeEvent {
  return {
    id,
    type: "checkout.session.completed",
    data: {
      object: {
        id: `cs_${id}`,
        mode: "subscription",
        customer: `cus_${workspaceId.slice(0, 8)}`,
        subscription: `sub_${workspaceId.slice(0, 8)}`,
        client_reference_id: userId,
        metadata: { userId, workspaceId },
      },
    },
  };
}

function subscriptionEvent(
  id: string,
  type: "customer.subscription.created" | "customer.subscription.updated" | "customer.subscription.deleted",
  input: {
    userId: string;
    workspaceId: string;
    status: string;
    start: Date;
    end: Date;
    cancelAtPeriodEnd?: boolean;
  },
): StripeLikeEvent {
  return {
    id,
    type,
    data: {
      object: {
        id: `sub_${input.workspaceId.slice(0, 8)}`,
        customer: `cus_${input.workspaceId.slice(0, 8)}`,
        status: input.status,
        cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
        metadata: { userId: input.userId, workspaceId: input.workspaceId },
        items: {
          data: [
            {
              price: { id: PRICE },
              current_period_start: unix(input.start),
              current_period_end: unix(input.end),
            },
          ],
        },
      },
    },
  };
}

function invoiceEvent(
  id: string,
  type: "invoice.paid" | "invoice.payment_failed",
  workspaceId: string,
  start: Date,
  end: Date,
): StripeLikeEvent {
  return {
    id,
    type,
    data: {
      object: {
        id: `in_${id}`,
        customer: `cus_${workspaceId.slice(0, 8)}`,
        subscription: `sub_${workspaceId.slice(0, 8)}`,
        period_start: unix(start),
        period_end: unix(end),
      },
    },
  };
}

describe("BizPilot Pro subscription", () => {
  it("activates paid access after checkout and an active subscription event", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store);
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    await applyStripeEvent(store, checkoutEvent("evt_co_1", user.id, workspace.id));
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_1", "customer.subscription.updated", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start,
        end,
      }),
    );
    const service = new BillingService(store);
    const paid = await service.requirePaidWorkspace(user.id, workspace.id, start);
    assert.equal(paid.subscription.status, "active");
    const usage = await service.peekUsage(workspace.id, start);
    assert.equal(usage.remaining, BIZPILOT_PRO.replyLimit);
    assert.equal(hasPaidDashboardAccess(paid.subscription, start), true);
  });

  it("blocks dashboard and widget after a failed payment", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store);
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    await applyStripeEvent(store, checkoutEvent("evt_co_fail", user.id, workspace.id));
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_fail", "customer.subscription.updated", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start,
        end,
      }),
    );
    await applyStripeEvent(
      store,
      invoiceEvent("evt_inv_fail", "invoice.payment_failed", workspace.id, start, end),
    );
    const service = new BillingService(store);
    await assert.rejects(
      () => service.requirePaidWorkspace(user.id, workspace.id, start),
      (error: unknown) => error instanceof BillingError && error.code === "inactive",
    );
    await assert.rejects(
      () => service.assertWidgetCanReply(workspace.widgetKey, start),
      (error: unknown) => error instanceof BillingError && error.code === "inactive",
    );
    const notes = await store.listNotifications(user.id, workspace.id);
    assert.ok(notes.some((row) => row.type === "payment_failed"));
  });

  it("blocks access after cancellation", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store);
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    await applyStripeEvent(store, checkoutEvent("evt_co_c", user.id, workspace.id));
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_c1", "customer.subscription.updated", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start,
        end,
      }),
    );
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_c2", "customer.subscription.deleted", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "canceled",
        start,
        end,
      }),
    );
    const service = new BillingService(store);
    await assert.rejects(
      () => service.requirePaidWorkspace(user.id, workspace.id, start),
      (error: unknown) => error instanceof BillingError && error.code === "inactive",
    );
  });

  it("ignores webhook replays", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store);
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    const event = subscriptionEvent("evt_replay", "customer.subscription.updated", {
      userId: user.id,
      workspaceId: workspace.id,
      status: "active",
      start,
      end,
    });
    const first = await applyStripeEvent(store, event);
    const second = await applyStripeEvent(store, event);
    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    const service = new BillingService(store);
    await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "v1",
      question: "Do you provide website hosting?",
      now: start,
      generate: async () => "Hosting is only included when the project agreement says so.",
    });
    await applyStripeEvent(store, event);
    const usage = await service.peekUsage(workspace.id, start);
    assert.equal(usage.period.repliesUsed, 1);
  });

  it("isolates one business from another", async () => {
    const store = new MemoryBillingStore();
    const a = await seedAccount(store, "Alpha");
    const b = await seedAccount(store, "Beta");
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    for (const account of [a, b]) {
      await applyStripeEvent(
        store,
        checkoutEvent(`evt_co_${account.workspace.id}`, account.user.id, account.workspace.id),
      );
      await applyStripeEvent(
        store,
        subscriptionEvent(`evt_sub_${account.workspace.id}`, "customer.subscription.updated", {
          userId: account.user.id,
          workspaceId: account.workspace.id,
          status: "active",
          start,
          end,
        }),
      );
    }
    const service = new BillingService(store);
    await assert.rejects(
      () => service.requirePaidWorkspace(a.user.id, b.workspace.id, start),
      (error: unknown) => error instanceof BillingError && error.code === "forbidden",
    );
    await service.generateCountedAiReply({
      widgetKey: a.workspace.widgetKey,
      visitorKey: "va",
      question: "Hours?",
      now: start,
      generate: async () => "Nine to five.",
    });
    const usageA = await service.peekUsage(a.workspace.id, start);
    const usageB = await service.peekUsage(b.workspace.id, start);
    assert.equal(usageA.period.repliesUsed, 1);
    assert.equal(usageB.period.repliesUsed, 0);
    const convosB = await store.listConversations(b.workspace.id);
    assert.equal(convosB.length, 0);
    const convosA = await store.listConversations(a.workspace.id);
    const leaked = await store.getConversation(convosA[0]!.id, b.workspace.id);
    assert.equal(leaked, null);
    const socialA = await store.createSocialMessage({
      workspaceId: a.workspace.id,
      widgetKey: a.workspace.widgetKey,
      platform: "instagram",
      fromName: "Pat",
      handle: "@pat",
      body: "Do you ship to Alaska?",
      status: "draft_ready",
      draftBody: "We ship to Alaska for $18.",
      intent: "store_shipping",
      operatorNote: "Draft only.",
      usedInternalKnowledge: false,
    });
    assert.equal((await store.listSocialMessages(b.workspace.id, b.workspace.widgetKey)).length, 0);
    assert.equal(
      (await store.listSocialMessages(a.workspace.id, b.workspace.widgetKey)).length,
      0,
    );
    assert.equal(
      await store.getSocialMessage(socialA.id, b.workspace.id, b.workspace.widgetKey),
      null,
    );
    await assert.rejects(() =>
      store.updateSocialMessage(socialA.id, b.workspace.id, b.workspace.widgetKey, {
        status: "posted",
      }),
    );
    const visible = await store.listSocialMessages(a.workspace.id, a.workspace.widgetKey);
    assert.equal(visible.length, 1);
    assert.equal(visible[0]?.id, socialA.id);
    const emailA = await store.createEmailDraft({
      workspaceId: a.workspace.id,
      widgetKey: a.workspace.widgetKey,
      fromName: "Pat",
      fromEmail: "pat@example.com",
      subject: "Hours",
      body: "When are you open?",
      status: "draft_ready",
      draftSubject: "Re: Hours",
      draftBody: "Nine to five.",
      intent: "hours",
      operatorNote: "Draft only.",
      usedInternalKnowledge: false,
    });
    assert.equal((await store.listEmailDrafts(b.workspace.id, b.workspace.widgetKey)).length, 0);
    assert.equal((await store.listEmailDrafts(a.workspace.id, b.workspace.widgetKey)).length, 0);
    assert.equal(await store.getEmailDraft(emailA.id, b.workspace.id, b.workspace.widgetKey), null);
    await assert.rejects(() =>
      store.updateEmailDraft(emailA.id, b.workspace.id, b.workspace.widgetKey, { status: "sent" }),
    );
    const emailVisible = await store.listEmailDrafts(a.workspace.id, a.workspace.widgetKey);
    assert.equal(emailVisible.length, 1);
    assert.equal(emailVisible[0]?.id, emailA.id);
    await store.upsertGmailConnection({
      workspaceId: a.workspace.id,
      googleEmail: "owner-a@gmail.com",
      encryptedRefreshToken: "ciphertext-refresh",
      encryptedAccessToken: "ciphertext-access",
      accessTokenExpiresAt: new Date("2026-09-12T12:00:00Z"),
      scopes: "gmail.readonly gmail.send",
      status: "connected",
    });
    assert.equal(await store.getGmailConnection(b.workspace.id), null);
    await store.upsertGmailReplyDraft({
      workspaceId: a.workspace.id,
      gmailMessageId: "msg_a",
      gmailThreadId: "thread_a",
      fromName: "Pat",
      fromEmail: "pat@example.com",
      subject: "Hours",
      body: "When are you open?",
      draftSubject: "Re: Hours",
      draftBody: "Nine to five.",
      intent: "hours",
      operatorNote: "Draft only.",
      usedInternalKnowledge: false,
      status: "draft",
    });
    assert.equal(await store.getGmailReplyDraft(b.workspace.id, "msg_a"), null);
    await assert.rejects(() => store.claimGmailReplySend(b.workspace.id, "msg_a"));
    await store.deleteGmailConnection(a.workspace.id);
    assert.equal(await store.getGmailConnection(a.workspace.id), null);
    assert.equal(await store.getGmailReplyDraft(a.workspace.id, "msg_a"), null);
  });

  it("resets the 500-reply allowance when a new Stripe period starts", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store);
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    const nextStart = end;
    const nextEnd = new Date("2026-11-01T00:00:00Z");
    await applyStripeEvent(store, checkoutEvent("evt_co_reset", user.id, workspace.id));
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_p1", "customer.subscription.updated", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start,
        end,
      }),
    );
    const service = new BillingService(store);
    for (let i = 0; i < 3; i += 1) {
      await service.generateCountedAiReply({
        widgetKey: workspace.widgetKey,
        visitorKey: `v${i}`,
        question: SAFE_QUESTION,
        now: start,
        generate: async () => "Hi",
      });
    }
    assert.equal((await service.peekUsage(workspace.id, start)).period.repliesUsed, 3);
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_p2", "customer.subscription.updated", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start: nextStart,
        end: nextEnd,
      }),
    );
    const next = await service.peekUsage(workspace.id, nextStart);
    assert.equal(next.period.repliesUsed, 0);
    assert.equal(next.remaining, BIZPILOT_PRO.replyLimit);
    const previous = await store.getUsagePeriod(workspace.id, start.getTime());
    assert.equal(previous?.repliesUsed, 3);
  });

  it("counts usage only after a successful AI response and stops at 500", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store);
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    await applyStripeEvent(store, checkoutEvent("evt_co_lim", user.id, workspace.id));
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_lim", "customer.subscription.updated", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start,
        end,
      }),
    );
    const service = new BillingService(store);
    await assert.rejects(
      () =>
        service.generateCountedAiReply({
          widgetKey: workspace.widgetKey,
          visitorKey: "fail",
          question: SAFE_QUESTION,
          now: start,
          generate: async () => {
            throw new Error("model_down");
          },
        }),
      /model_down/,
    );
    assert.equal((await service.peekUsage(workspace.id, start)).period.repliesUsed, 0);

    const period = (await service.peekUsage(workspace.id, start)).period;
    period.repliesUsed = BIZPILOT_PRO.replyLimit - 1;
    await store.ensureUsagePeriod({
      workspaceId: workspace.id,
      subscriptionId: period.subscriptionId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      replyLimit: period.replyLimit,
    });
    const stored = await store.getUsagePeriod(workspace.id, start.getTime());
    assert.ok(stored);
    stored!.repliesUsed = BIZPILOT_PRO.replyLimit - 1;

    const last = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "last",
      question: SAFE_QUESTION,
      now: start,
      generate: async () => "Counted.",
    });
    assert.equal(last.usage?.used, BIZPILOT_PRO.replyLimit);
    assert.equal(last.usage?.remaining, 0);
    const over = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "over",
      question: SAFE_QUESTION,
      now: start,
      generate: async () => "Should not count",
    });
    assert.equal(over.waitingOnHuman, true);
    assert.equal(over.usage?.remaining, 0);
    assert.equal((await service.peekUsage(workspace.id, start)).period.repliesUsed, BIZPILOT_PRO.replyLimit);
    const overThread = await store.getConversationForVisitor(workspace.id, "over");
    assert.equal(overThread?.waitingOnHuman, true);
    const overMessages = await store.listMessages(overThread!.id, workspace.id);
    assert.equal(
      overMessages.some((row) => row.role === "visitor" && row.content === SAFE_QUESTION),
      true,
    );
    const notes = await store.listNotifications(user.id, workspace.id);
    assert.equal(notes.filter((row) => row.type === "usage_limit").length, 1);
  });

  it("keeps status active when invoice.paid and subscription.created arrive before checkout.session.completed", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store);
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    const stripeSubscriptionId = `sub_${workspace.id.slice(0, 8)}`;
    const live = {
      async retrieveSubscription(id: string) {
        assert.equal(id, stripeSubscriptionId);
        return {
          id,
          customer: `cus_${workspace.id.slice(0, 8)}`,
          status: "active",
          cancel_at_period_end: false,
          metadata: { userId: user.id, workspaceId: workspace.id },
          items: {
            data: [
              {
                price: { id: PRICE },
                current_period_start: unix(start),
                current_period_end: unix(end),
              },
            ],
          },
        };
      },
    };

    await applyStripeEvent(
      store,
      invoiceEvent("evt_inv_first", "invoice.paid", workspace.id, start, end),
      live,
    );
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_created_active", "customer.subscription.created", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start,
        end,
      }),
      live,
    );
    await applyStripeEvent(store, checkoutEvent("evt_co_last", user.id, workspace.id), live);

    const subscription = await store.getSubscriptionByWorkspace(workspace.id);
    assert.equal(subscription?.status, "active");
    assert.equal(subscription?.stripeSubscriptionId, stripeSubscriptionId);
    assert.equal(subscription?.stripeCustomerId, `cus_${workspace.id.slice(0, 8)}`);
    assert.equal(subscription?.stripePriceId, PRICE);
    const service = new BillingService(store);
    const paid = await service.requirePaidWorkspace(user.id, workspace.id, start);
    assert.equal(paid.subscription.status, "active");
    assert.equal(hasPaidDashboardAccess(paid.subscription, start), true);
  });

  it("does not let a late checkout.session.completed downgrade an active subscription to incomplete", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store);
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    await applyStripeEvent(
      store,
      invoiceEvent("evt_inv_stale", "invoice.paid", workspace.id, start, end),
    );
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_already_active", "customer.subscription.created", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start,
        end,
      }),
    );
    const staleCheckoutReader = {
      async retrieveSubscription() {
        return {
          id: `sub_${workspace.id.slice(0, 8)}`,
          customer: `cus_${workspace.id.slice(0, 8)}`,
          status: "incomplete",
          metadata: { userId: user.id, workspaceId: workspace.id },
        };
      },
    };
    await applyStripeEvent(
      store,
      checkoutEvent("evt_co_stale_incomplete", user.id, workspace.id),
      staleCheckoutReader,
    );
    const subscription = await store.getSubscriptionByWorkspace(workspace.id);
    assert.equal(subscription?.status, "active");
  });

  it("pauses AI for a human reply without burning quota, and hides other visitors' threads", async () => {
    const store = new MemoryBillingStore();
    const a = await seedAccount(store, "Harbor");
    const b = await seedAccount(store, "Inland");
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    for (const account of [a, b]) {
      await applyStripeEvent(
        store,
        checkoutEvent(`evt_co_h_${account.workspace.id}`, account.user.id, account.workspace.id),
      );
      await applyStripeEvent(
        store,
        subscriptionEvent(`evt_sub_h_${account.workspace.id}`, "customer.subscription.updated", {
          userId: account.user.id,
          workspaceId: account.workspace.id,
          status: "active",
          start,
          end,
        }),
      );
    }
    const service = new BillingService(store);
    const first = await service.generateCountedAiReply({
      widgetKey: a.workspace.widgetKey,
      visitorKey: "visitor-a",
      question: "Hours?",
      now: start,
      generate: async () => "Nine to five.",
    });
    assert.equal(first.usage?.used, 1);
    await service.handoffToHuman(a.workspace.widgetKey, first.conversationId, start);
    const paused = await service.generateCountedAiReply({
      widgetKey: a.workspace.widgetKey,
      visitorKey: "visitor-a",
      conversationId: first.conversationId,
      question: "Still there?",
      now: start,
      generate: async () => "Should not run",
    });
    assert.equal(paused.waitingOnHuman, true);
    assert.equal(paused.usage, null);
    assert.equal((await service.peekUsage(a.workspace.id, start)).period.repliesUsed, 1);
    const reply = await service.sendOperatorReply({
      workspaceId: a.workspace.id,
      conversationId: first.conversationId,
      content: "We open at nine.",
    });
    assert.equal(reply.message.role, "human");
    await assert.rejects(
      () =>
        service.sendOperatorReply({
          workspaceId: b.workspace.id,
          conversationId: first.conversationId,
          content: "Leaked reply",
        }),
      (error: unknown) => error instanceof BillingError && error.code === "not_found",
    );
    const leaked = await service.loadWidgetThread(
      a.workspace.widgetKey,
      "other-visitor",
      first.conversationId,
    );
    assert.equal(leaked.conversation, null);
    assert.equal(leaked.messages.length, 0);
    const own = await service.loadWidgetThread(
      a.workspace.widgetKey,
      "visitor-a",
      first.conversationId,
    );
    assert.equal(own.conversation?.id, first.conversationId);
    assert.equal(own.messages.some((row) => row.role === "human"), true);
    await service.resumeAi(a.workspace.id, first.conversationId);
    const resumed = await service.generateCountedAiReply({
      widgetKey: a.workspace.widgetKey,
      visitorKey: "visitor-a",
      conversationId: first.conversationId,
      question: SAFE_QUESTION,
      now: start,
      generate: async () => "You're welcome.",
    });
    assert.equal(resumed.waitingOnHuman, false);
    assert.equal((await service.peekUsage(a.workspace.id, start)).period.repliesUsed, 2);
  });

  it("answers safe website questions with AI and freezes legal ones without burning quota", async () => {
    const store = new MemoryBillingStore();
    const { user, workspace } = await seedAccount(store, "Shoreline");
    const start = new Date("2026-09-01T00:00:00Z");
    const end = new Date("2026-10-01T00:00:00Z");
    await applyStripeEvent(store, checkoutEvent("evt_co_gate", user.id, workspace.id));
    await applyStripeEvent(
      store,
      subscriptionEvent("evt_sub_gate", "customer.subscription.updated", {
        userId: user.id,
        workspaceId: workspace.id,
        status: "active",
        start,
        end,
      }),
    );
    const service = new BillingService(store);
    let generated = 0;
    const safe = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "safe",
      question: "Do you provide website hosting?",
      now: start,
      generate: async () => {
        generated += 1;
        return "Northwind Studio does web projects.";
      },
    });
    assert.equal(safe.waitingOnHuman, false);
    assert.equal(generated, 1);
    assert.equal(safe.usage?.used, 1);

    generated = 0;
    const frozen = await service.generateCountedAiReply({
      widgetKey: workspace.widgetKey,
      visitorKey: "legal",
      question: "I will sue you and call my lawyer.",
      now: start,
      generate: async () => {
        generated += 1;
        return "Should not run";
      },
    });
    assert.equal(frozen.waitingOnHuman, true);
    assert.equal(generated, 0);
    assert.equal(frozen.usage, null);
    assert.equal((await service.peekUsage(workspace.id, start)).period.repliesUsed, 1);
  });
});
