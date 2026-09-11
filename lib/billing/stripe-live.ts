import { getStripe } from "@/lib/stripe";
import type { StripeLiveLookup } from "./stripe-events";

export function stripeLiveLookup(): StripeLiveLookup {
  return {
    async retrieveSubscription(subscriptionId: string) {
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      return subscription as unknown as Record<string, unknown>;
    },
  };
}
