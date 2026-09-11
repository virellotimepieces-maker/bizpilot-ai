const REQUIRED_PAID = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID",
  "APP_URL",
  "OPENAI_API_KEY",
] as const;

export type PaidEnvName = (typeof REQUIRED_PAID)[number];

export function missingPaidEnv(): PaidEnvName[] {
  return REQUIRED_PAID.filter((name) => !process.env[name]?.trim());
}

export function isPaidPlatformConfigured() {
  return missingPaidEnv().length === 0;
}

export function requireEnv(name: PaidEnvName | "OPENAI_MODEL" | "STRIPE_PUBLISHABLE_KEY") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

export const ENV_DOCS = [
  {
    name: "DATABASE_URL",
    why: "PostgreSQL connection string for this BizPilot project only. Do not reuse another app’s database.",
  },
  {
    name: "AUTH_SECRET",
    why: "Random 32+ byte secret used to sign login session cookies.",
  },
  {
    name: "APP_URL",
    why: "Public origin, for example https://your-domain.vercel.app, used in Stripe redirects and the widget snippet.",
  },
  {
    name: "STRIPE_SECRET_KEY",
    why: "Stripe secret key for this BizPilot account (sk_test_ or sk_live_). Do not reuse keys from other apps.",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    why: "Signing secret for the /api/stripe/webhook endpoint (whsec_...).",
  },
  {
    name: "STRIPE_PRICE_ID",
    why: "Recurring monthly Price ID for BizPilot Pro at USD $29. Create a Product named BizPilot Pro in Stripe, then paste the price_… id.",
  },
  {
    name: "STRIPE_PUBLISHABLE_KEY",
    why: "Optional. Publishable key if you later add Stripe.js on the client.",
  },
  {
    name: "OPENAI_API_KEY",
    why: "Server-side key used only for paid widget AI replies. Usage is counted after a successful model response.",
  },
  {
    name: "OPENAI_MODEL",
    why: "Optional. Defaults to gpt-4o-mini.",
  },
  {
    name: "CRON_SECRET",
    why: "Optional. Bearer token for GET /api/cron/website-sync if you invoke it outside Vercel Cron.",
  },
] as const;
