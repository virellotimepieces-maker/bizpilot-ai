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
        question: "Hello",
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
          question: "Hello",
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
      question: "Last one",
      now: start,
      generate: async () => "Counted.",
    });
    assert.equal(last.usage.used, BIZPILOT_PRO.replyLimit);
    assert.equal(last.usage.remaining, 0);
    await assert.rejects(
      () =>
        service.generateCountedAiReply({
          widgetKey: workspace.widgetKey,
          visitorKey: "over",
          question: "One more",
          now: start,
          generate: async () => "Should not count",
        }),
      (error: unknown) => error instanceof BillingError && error.code === "limit",
    );
    assert.equal((await service.peekUsage(workspace.id, start)).period.repliesUsed, BIZPILOT_PRO.replyLimit);
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
});
