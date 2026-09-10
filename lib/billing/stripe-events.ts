import { BIZPILOT_PRO } from "@/lib/plan";
import type { BillingStore } from "./store";
import type { StripeLikeEvent, SubscriptionStatus } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function unixToDate(value: unknown): Date | null {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value * 1000);
  if (typeof value === "string" && /^\d+$/.test(value)) return new Date(Number(value) * 1000);
  return null;
}

function metadata(object: Record<string, unknown>) {
  return asRecord(object.metadata);
}

function periodFromSubscription(object: Record<string, unknown>) {
  const items = asRecord(object.items);
  const data = Array.isArray(items.data) ? items.data : [];
  const first = asRecord(data[0]);
  const start =
    unixToDate(first.current_period_start) ?? unixToDate(object.current_period_start);
  const end = unixToDate(first.current_period_end) ?? unixToDate(object.current_period_end);
  const price = asRecord(asRecord(first.price).id ? first.price : asRecord(first.plan));
  return {
    start,
    end,
    priceId: asString(price.id) ?? asString(asRecord(object.plan).id),
  };
}

function asStatus(value: unknown): SubscriptionStatus {
  const status = asString(value) ?? "inactive";
  return status as SubscriptionStatus;
}

export async function applyStripeEvent(store: BillingStore, event: StripeLikeEvent) {
  const inserted = await store.markStripeEventProcessed(event.id, event.type);
  if (!inserted) {
    return { duplicate: true as const, changed: false as const };
  }

  const object = asRecord(event.data.object);

  if (event.type === "checkout.session.completed") {
    const workspaceId = asString(metadata(object).workspaceId);
    const userId = asString(metadata(object).userId) ?? asString(object.client_reference_id);
    const customerId = asString(object.customer);
    const subscriptionId = asString(object.subscription);
    if (!workspaceId || !userId) {
      return { duplicate: false as const, changed: false as const };
    }
    const membership = await store.getMembership(userId, workspaceId);
    if (!membership) {
      return { duplicate: false as const, changed: false as const };
    }
    const subscription = await store.upsertSubscription({
      workspaceId,
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: "incomplete",
    });
    return { duplicate: false as const, changed: true as const, subscription };
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return syncSubscriptionObject(store, object, event.type === "customer.subscription.deleted");
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const subscriptionId =
      asString(object.subscription) ??
      asString(asRecord(object.parent).subscription_details ? asRecord(asRecord(object.parent).subscription_details).subscription : null);
    if (!subscriptionId) {
      return { duplicate: false as const, changed: false as const };
    }
    const existing = await store.getSubscriptionByStripeId(subscriptionId);
    if (!existing) {
      return { duplicate: false as const, changed: false as const };
    }
    if (event.type === "invoice.payment_failed") {
      const subscription = await store.upsertSubscription({
        workspaceId: existing.workspaceId,
        userId: existing.userId,
        stripeCustomerId: existing.stripeCustomerId,
        stripeSubscriptionId: existing.stripeSubscriptionId,
        status: "past_due",
      });
      await store.addNotification({
        userId: existing.userId,
        workspaceId: existing.workspaceId,
        type: "payment_failed",
        message:
          "A BizPilot Pro payment failed. The dashboard and website widget are paused until billing is updated. There are no automatic overage charges.",
      });
      return { duplicate: false as const, changed: true as const, subscription };
    }
    const periodStart = unixToDate(object.period_start) ?? existing.currentPeriodStart;
    const periodEnd = unixToDate(object.period_end) ?? existing.currentPeriodEnd;
    const subscription = await store.upsertSubscription({
      workspaceId: existing.workspaceId,
      userId: existing.userId,
      stripeCustomerId: existing.stripeCustomerId,
      stripeSubscriptionId: existing.stripeSubscriptionId,
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: existing.cancelAtPeriodEnd,
      canceledAt: null,
    });
    if (periodStart && periodEnd) {
      await store.ensureUsagePeriod({
        workspaceId: existing.workspaceId,
        subscriptionId: subscription.id,
        periodStart,
        periodEnd,
        replyLimit: BIZPILOT_PRO.replyLimit,
      });
    }
    return { duplicate: false as const, changed: true as const, subscription };
  }

  return { duplicate: false as const, changed: false as const };
}

async function syncSubscriptionObject(
  store: BillingStore,
  object: Record<string, unknown>,
  deleted: boolean,
) {
  const stripeSubscriptionId = asString(object.id);
  const meta = metadata(object);
  const workspaceId =
    asString(meta.workspaceId) ??
    (await store.getSubscriptionByStripeId(stripeSubscriptionId ?? ""))?.workspaceId ??
    null;
  const userId =
    asString(meta.userId) ??
    (workspaceId ? (await store.getSubscriptionByWorkspace(workspaceId))?.userId : null);
  if (!workspaceId || !userId || !stripeSubscriptionId) {
    return { duplicate: false as const, changed: false as const };
  }
  const membership = await store.getMembership(userId, workspaceId);
  if (!membership) {
    return { duplicate: false as const, changed: false as const };
  }

  const period = periodFromSubscription(object);
  const status: SubscriptionStatus = deleted ? "canceled" : asStatus(object.status);
  const cancelAtPeriodEnd = Boolean(object.cancel_at_period_end);
  const subscription = await store.upsertSubscription({
    workspaceId,
    userId,
    stripeCustomerId: asString(object.customer),
    stripeSubscriptionId,
    stripePriceId: period.priceId,
    status,
    cancelAtPeriodEnd,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    canceledAt: deleted ? new Date() : unixToDate(object.canceled_at),
  });

  if (isOpenPeriod(status, period.start, period.end)) {
    await store.ensureUsagePeriod({
      workspaceId,
      subscriptionId: subscription.id,
      periodStart: period.start!,
      periodEnd: period.end!,
      replyLimit: BIZPILOT_PRO.replyLimit,
    });
  }

  if (deleted) {
    await store.addNotification({
      userId,
      workspaceId,
      type: "canceled",
      message: "BizPilot Pro was canceled. The dashboard and website widget are paused.",
    });
  } else if (status === "active" || status === "trialing") {
    const notes = await store.listNotifications(userId, workspaceId);
    if (!notes.some((row) => row.type === "activated")) {
      await store.addNotification({
        userId,
        workspaceId,
        type: "activated",
        message: `BizPilot Pro is active. This workspace includes one website widget and ${BIZPILOT_PRO.replyLimit} AI customer replies each billing month.`,
      });
    }
  }

  return { duplicate: false as const, changed: true as const, subscription };
}

function isOpenPeriod(
  status: SubscriptionStatus,
  start: Date | null,
  end: Date | null,
): start is Date {
  return (status === "active" || status === "trialing") && Boolean(start && end);
}
