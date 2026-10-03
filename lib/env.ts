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
    why: "Public origin, for example https://www.mybizpilotai.com, used in Stripe redirects and the widget snippet.",
  },
  {
    name: "STRIPE_SECRET_KEY",
    why: "Stripe Live secret key for this BizPilot account (sk_live_). Do not use sk_test_ on Production if you are taking real cards.",
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
    why: "Server-side key used for paid widget AI replies and Gmail suggested replies.",
  },
  {
    name: "OPENAI_MODEL",
    why: "Optional. Defaults to gpt-4o-mini.",
  },
  {
    name: "CRON_SECRET",
    why: "Optional. Bearer token for GET /api/cron/website-sync if you invoke it outside Vercel Cron.",
  },
  {
    name: "GOOGLE_CLIENT_ID",
    why: "Optional. Google OAuth client ID for Connect Gmail on the paid Email page.",
  },
  {
    name: "GOOGLE_CLIENT_SECRET",
    why: "Optional. Google OAuth client secret. Server-only. Never expose it in the browser.",
  },
  {
    name: "SHOPIFY_API_KEY",
    why: "Optional. Shopify app Client ID for Connect Shopify on Integrations. Server-only.",
  },
  {
    name: "SHOPIFY_API_SECRET",
    why: "Optional. Shopify app Client secret. Server-only. Never expose it in the browser.",
  },
  {
    name: "META_APP_ID",
    why: "Optional. Meta app ID for Facebook Pages, Instagram professional accounts, and Threads. Server-only.",
  },
  {
    name: "META_APP_SECRET",
    why: "Optional. Meta app secret. Server-only. Never expose it in the browser.",
  },
  {
    name: "META_PUBLISH_ENABLED",
    why: "Optional. Set to true only after Meta App Review approves pages_manage_posts for Facebook Page publishing.",
  },
  {
    name: "META_INSTAGRAM_PUBLISH_ENABLED",
    why: "Optional. Set to true only after Meta App Review approves instagram_content_publish.",
  },
  {
    name: "THREADS_PUBLISH_ENABLED",
    why: "Optional. Set to true only after Threads API access review approves threads_content_publish.",
  },
  {
    name: "LINKEDIN_CLIENT_ID",
    why: "Optional. LinkedIn app client ID for member posting. Server-only.",
  },
  {
    name: "LINKEDIN_CLIENT_SECRET",
    why: "Optional. LinkedIn app client secret. Server-only. Never expose it in the browser.",
  },
  {
    name: "LINKEDIN_PUBLISH_ENABLED",
    why: "Optional. Set to true only after LinkedIn approves w_member_social.",
  },
  {
    name: "X_CLIENT_ID",
    why: "Optional. X OAuth 2.0 client ID. Server-only.",
  },
  {
    name: "X_CLIENT_SECRET",
    why: "Optional. X OAuth 2.0 client secret. Server-only. Never expose it in the browser.",
  },
  {
    name: "X_POSTING_ENABLED",
    why: "Optional. Set to true only after a paid X API tier allows POST /2/tweets.",
  },
  {
    name: "PINTEREST_APP_ID",
    why: "Optional. Pinterest app ID. Server-only.",
  },
  {
    name: "PINTEREST_APP_SECRET",
    why: "Optional. Pinterest app secret. Server-only. Never expose it in the browser.",
  },
  {
    name: "PINTEREST_PUBLISH_ENABLED",
    why: "Optional. Set to true only after Pinterest standard access approves pins:write.",
  },
] as const;
