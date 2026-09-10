import Stripe from "stripe";
import { requireEnv } from "@/lib/env";

let stripe: Stripe | null = null;

export function getStripe() {
  stripe ??= new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return stripe;
}

export function appUrl() {
  return requireEnv("APP_URL").replace(/\/$/, "");
}
