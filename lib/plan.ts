/** Public commercial terms. Stripe Price IDs live in environment variables, never here. */
export const BIZPILOT_PRO = {
  id: "bizpilot_pro",
  name: "BizPilot Pro",
  amountCents: 2900,
  currency: "usd",
  interval: "month" as const,
  replyLimit: 500,
  workspaceLimit: 1,
  widgetLimit: 1,
  cancelAnytime: true,
  automaticOverageCharges: false,
} as const;

export type PlanId = typeof BIZPILOT_PRO.id;

export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export type AccessibleSubscriptionStatus = (typeof ACTIVE_SUBSCRIPTION_STATUSES)[number];

export function isPaidAccessStatus(status: string): status is AccessibleSubscriptionStatus {
  return (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status);
}
