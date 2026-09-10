import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { appUrl, getStripe } from "@/lib/stripe";

export async function POST() {
  try {
    const userId = await getSessionUserId();
    if (!userId) throw new BillingError("Sign in required.", "unauthorized");
    const store = getBillingStore();
    const workspaces = await store.listWorkspacesForUser(userId);
    const workspace = workspaces[0];
    if (!workspace) throw new BillingError("No workspace found.", "not_found");
    const subscription = await store.getSubscriptionByWorkspace(workspace.id);
    if (!subscription?.stripeCustomerId) {
      throw new BillingError("No Stripe customer is on file yet. Subscribe first.", "invalid");
    }
    const portal = await getStripe().billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${appUrl()}/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    return jsonError(error, "Could not open the billing portal.");
  }
}
