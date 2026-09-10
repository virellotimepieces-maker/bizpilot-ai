import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { getBillingStore } from "@/lib/billing/factory";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { appUrl, getStripe } from "@/lib/stripe";
import { requireEnv } from "@/lib/env";

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
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [{ price: requireEnv("STRIPE_PRICE_ID"), quantity: 1 }],
      success_url: `${appUrl()}/billing?checkout=success`,
      cancel_url: `${appUrl()}/billing?checkout=cancel`,
      metadata: { userId, workspaceId: workspace.id },
      subscription_data: {
        metadata: { userId, workspaceId: workspace.id },
      },
    });
    if (!session.url) {
      throw new BillingError("Stripe did not return a checkout URL.", "invalid");
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    return jsonError(error, "Could not start checkout.");
  }
}
