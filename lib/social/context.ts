import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { selectOperatingWorkspace } from "@/lib/billing/operating-workspace";
import { BillingService, hasPaidDashboardAccess } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";

export async function requireSocialWorkspace() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspace = await selectOperatingWorkspace(store, userId);
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const service = new BillingService(store);
  const paid = await service.requirePaidWorkspace(userId, workspace.id);
  return { store, userId, service, subscriptionActive: true, ...paid };
}

export async function socialReadContext() {
  const userId = await getSessionUserId();
  if (!userId) throw new BillingError("Sign in required.", "unauthorized");
  const store = getBillingStore();
  const workspace = await selectOperatingWorkspace(store, userId);
  if (!workspace) throw new BillingError("No workspace found.", "not_found");
  const service = new BillingService(store);
  const member = await service.requireMembership(userId, workspace.id);
  const subscription = await store.getSubscriptionByWorkspace(workspace.id);
  return {
    store,
    userId,
    service,
    ...member,
    subscriptionActive: hasPaidDashboardAccess(subscription),
  };
}
