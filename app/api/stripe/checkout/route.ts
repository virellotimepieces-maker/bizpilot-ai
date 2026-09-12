import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { hasPaidDashboardAccess } from "@/lib/billing/service";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { appUrl, getStripe } from "@/lib/stripe";
import { requireEnv } from "@/lib/env";
import type Stripe from "stripe";

export async function POST(request: NextRequest) {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      throw new BillingError("Sign in required.", "unauthorized");
    }
    const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
    const store = getBillingStore();
    const workspaces = await store.listWorkspacesForUser(userId);
    const workspace = body.workspaceId
      ? workspaces.find((row) => row.id === body.workspaceId)
      : workspaces[0];
    if (!workspace) {
      throw new BillingError("No workspace found for this account.", "not_found");
    }
    const membership = await store.getMembership(userId, workspace.id);
    if (!membership) {
      throw new BillingError("This workspace is not available to your account.", "forbidden");
    }
    const user = await store.findUserById(userId);
    if (!user) {
      throw new BillingError("Sign in required.", "unauthorized");
    }
    const existing = await store.getSubscriptionByWorkspace(workspace.id);
    if (hasPaidDashboardAccess(existing)) {
      throw new BillingError("BizPilot Pro is already active on this workspace.", "conflict");
    }
    if (
      existing?.stripeCustomerId &&
      (existing.status === "past_due" || existing.status === "unpaid")
    ) {
      throw new BillingError(
        "A payment failed on this workspace. Open Customer Portal to update the card instead of starting a second subscription.",
        "conflict",
      );
    }
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      client_reference_id: user.id,
      line_items: [{ price: requireEnv("STRIPE_PRICE_ID"), quantity: 1 }],
      success_url: `${appUrl()}/billing?checkout=success`,
      cancel_url: `${appUrl()}/billing?checkout=cancel`,
      metadata: { userId, workspaceId: workspace.id },
      subscription_data: {
        metadata: { userId, workspaceId: workspace.id },
      },
    };
    if (existing?.stripeCustomerId) {
      sessionParams.customer = existing.stripeCustomerId;
    } else {
      sessionParams.customer_email = user.email;
    }
    const session = await getStripe().checkout.sessions.create(sessionParams);
    if (!session.url) {
      throw new BillingError("Stripe did not return a checkout URL.", "invalid");
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return jsonError(error, "Could not start checkout.");
  }
}
