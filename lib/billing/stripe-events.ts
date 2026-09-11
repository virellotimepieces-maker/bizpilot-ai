import { BIZPILOT_PRO, isPaidAccessStatus } from "@/lib/plan";
import type { BillingStore } from "./store";
import type { StripeLikeEvent, SubscriptionRecord, SubscriptionStatus } from "./types";

export type StripeLiveLookup = {
  retrieveSubscription(subscriptionId: string): Promise<Record<string, unknown> | null>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function asId(value: unknown) {
  const direct = asString(value);
  if (direct) return direct;
  return asString(asRecord(value).id);
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

function isCanceledStatus(status: SubscriptionStatus | undefined) {
  return status === "canceled" || status === "incomplete_expired";
}

/** Checkout (and other incomplete snapshots) must not wipe a paid subscription. */
export function withoutIncompleteDowngrade(
  existing: SubscriptionStatus | undefined,
  incoming: SubscriptionStatus,
): SubscriptionStatus {
  if (isPaidAccessStatus(existing ?? "") && incoming === "incomplete") {
    return existing as SubscriptionStatus;
  }
  return incoming;
}

async function readSubscription(
  stripe: StripeLiveLookup | undefined,
  subscriptionId: string | null,
) {
  if (!stripe || !subscriptionId) return null;
  try {
    return await stripe.retrieveSubscription(subscriptionId);
  } catch {
    return null;
  }
}

function invoiceSubscriptionId(object: Record<string, unknown>) {
  return (
    asId(object.subscription) ??
    asId(asRecord(asRecord(object.parent).subscription_details).subscription)
  );
}

export async function applyStripeEvent(
  store: BillingStore,
  event: StripeLikeEvent,
  stripe?: StripeLiveLookup,
) {
  const inserted = await store.markStripeEventProcessed(event.id, event.type);
  if (!inserted) {
    return { duplicate: true as const, changed: false as const };
  }

  const object = asRecord(event.data.object);

  if (event.type === "checkout.session.completed") {
    return applyCheckoutCompleted(store, object, stripe);
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    return syncSubscriptionObject(store, object, event.type === "customer.subscription.deleted");
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    return applyInvoice(store, event.type, object, stripe);
  }

  return { duplicate: false as const, changed: false as const };
}

async function applyCheckoutCompleted(
  store: BillingStore,
  object: Record<string, unknown>,
  stripe?: StripeLiveLookup,
) {
  const workspaceId = asString(metadata(object).workspaceId);
  const userId = asString(metadata(object).userId) ?? asString(object.client_reference_id);
  const customerId = asId(object.customer);
  const subscriptionId = asId(object.subscription);
  if (!workspaceId || !userId) {
    return { duplicate: false as const, changed: false as const };
  }
  const membership = await store.getMembership(userId, workspaceId);
  if (!membership) {
    return { duplicate: false as const, changed: false as const };
  }

  const existing =
    (await store.getSubscriptionByWorkspace(workspaceId)) ??
    (subscriptionId ? await store.getSubscriptionByStripeId(subscriptionId) : null);
  const retrieved = await readSubscription(stripe, subscriptionId);
  const live = retrieved ? periodFromSubscription(retrieved) : { start: null, end: null, priceId: null };
  const retrievedStatus = retrieved ? asStatus(retrieved.status) : null;
  const status = withoutIncompleteDowngrade(
    existing?.status,
    retrievedStatus ?? existing?.status ?? "incomplete",
  );

  const subscription = await store.upsertSubscription({
    workspaceId,
    userId,
    stripeCustomerId: customerId ?? asId(retrieved?.customer) ?? existing?.stripeCustomerId,
    stripeSubscriptionId: subscriptionId ?? asId(retrieved?.id) ?? existing?.stripeSubscriptionId,
    stripePriceId: live.priceId ?? existing?.stripePriceId,
    status,
    cancelAtPeriodEnd: retrieved
      ? Boolean(retrieved.cancel_at_period_end)
      : existing?.cancelAtPeriodEnd,
    currentPeriodStart: live.start ?? existing?.currentPeriodStart,
    currentPeriodEnd: live.end ?? existing?.currentPeriodEnd,
    canceledAt: isPaidAccessStatus(status)
      ? null
      : status === "canceled"
        ? (unixToDate(retrieved?.canceled_at) ?? existing?.canceledAt ?? new Date())
        : existing?.canceledAt,
  });

  await maybeEnsureUsage(store, subscription, live.start ?? existing?.currentPeriodStart ?? null, live.end ?? existing?.currentPeriodEnd ?? null);
  await maybeNotifyActivated(store, subscription);
  return { duplicate: false as const, changed: true as const, subscription };
}

async function applyInvoice(
  store: BillingStore,
  type: "invoice.paid" | "invoice.payment_failed",
  object: Record<string, unknown>,
  stripe?: StripeLiveLookup,
) {
  const subscriptionId = invoiceSubscriptionId(object);
  if (!subscriptionId) {
    return { duplicate: false as const, changed: false as const };
  }

  let existing = await store.getSubscriptionByStripeId(subscriptionId);
  if (!existing) {
    const retrieved = await readSubscription(stripe, subscriptionId);
    if (retrieved) {
      await syncSubscriptionObject(store, retrieved, false);
      existing = await store.getSubscriptionByStripeId(subscriptionId);
    }
  }
  if (!existing) {
    return { duplicate: false as const, changed: false as const };
  }
  if (isCanceledStatus(existing.status)) {
    return { duplicate: false as const, changed: false as const };
  }

  if (type === "invoice.payment_failed") {
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
    status: withoutIncompleteDowngrade(existing.status, "active"),
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
  await maybeNotifyActivated(store, subscription);
  return { duplicate: false as const, changed: true as const, subscription };
}

async function syncSubscriptionObject(
  store: BillingStore,
  object: Record<string, unknown>,
  deleted: boolean,
) {
  const stripeSubscriptionId = asId(object.id);
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

  const existing = await store.getSubscriptionByWorkspace(workspaceId);
  const period = periodFromSubscription(object);
  const incoming: SubscriptionStatus = deleted ? "canceled" : asStatus(object.status);
  const status = deleted ? "canceled" : withoutIncompleteDowngrade(existing?.status, incoming);
  const cancelAtPeriodEnd = Boolean(object.cancel_at_period_end);
  const subscription = await store.upsertSubscription({
    workspaceId,
    userId,
    stripeCustomerId: asId(object.customer),
    stripeSubscriptionId,
    stripePriceId: period.priceId,
    status,
    cancelAtPeriodEnd,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    canceledAt: deleted ? new Date() : unixToDate(object.canceled_at),
  });

  await maybeEnsureUsage(store, subscription, period.start, period.end);

  if (deleted) {
    await store.addNotification({
      userId,
      workspaceId,
      type: "canceled",
      message: "BizPilot Pro was canceled. The dashboard and website widget are paused.",
    });
  } else {
    await maybeNotifyActivated(store, subscription);
  }

  return { duplicate: false as const, changed: true as const, subscription };
}

async function maybeEnsureUsage(
  store: BillingStore,
  subscription: SubscriptionRecord,
  start: Date | null | undefined,
  end: Date | null | undefined,
) {
  if (!isPaidAccessStatus(subscription.status) || !start || !end) return;
  await store.ensureUsagePeriod({
    workspaceId: subscription.workspaceId,
    subscriptionId: subscription.id,
    periodStart: start,
    periodEnd: end,
    replyLimit: BIZPILOT_PRO.replyLimit,
  });
}

async function maybeNotifyActivated(store: BillingStore, subscription: SubscriptionRecord) {
  if (!isPaidAccessStatus(subscription.status)) return;
  const notes = await store.listNotifications(subscription.userId, subscription.workspaceId);
  if (notes.some((row) => row.type === "activated")) return;
  await store.addNotification({
    userId: subscription.userId,
    workspaceId: subscription.workspaceId,
    type: "activated",
    message: `BizPilot Pro is active. This workspace includes one website widget and ${BIZPILOT_PRO.replyLimit} AI customer replies each billing month.`,
  });
}
