import { NextRequest, NextResponse } from "next/server";
import { getBillingStore } from "@/lib/billing/factory";
import { applyStripeEvent } from "@/lib/billing/stripe-events";
import { stripeLiveLookup } from "@/lib/billing/stripe-live";
import { jsonError } from "@/lib/http";
import { getStripe } from "@/lib/stripe";
import { requireEnv } from "@/lib/env";
import type { StripeLikeEvent } from "@/lib/billing/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }
  try {
    const event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      requireEnv("STRIPE_WEBHOOK_SECRET"),
    );
    const store = getBillingStore();
    const result = await applyStripeEvent(
      store,
      event as unknown as StripeLikeEvent,
      stripeLiveLookup(),
    );
    return NextResponse.json({ received: true, ...result });
  } catch (error) {
    if (error instanceof Error && /signature/i.test(error.message)) {
      return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
    }
    return jsonError(error, "Webhook processing failed.");
  }
}
