export type EnvMap = Record<string, string | undefined>;

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export const OPERATOR_FOUNDATION_VARS = ["DATABASE_URL", "AUTH_SECRET", "APP_URL"] as const;
export const OPERATOR_STRIPE_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ID",
] as const;
export const OPERATOR_OPENAI_VARS = ["OPENAI_API_KEY"] as const;
export const OPERATOR_GMAIL_VARS = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

export type OperatorCheckKey = "foundation" | "stripe" | "openai" | "gmail";

export type OperatorCheck = {
  key: OperatorCheckKey;
  label: string;
  required: boolean;
  done: boolean;
  missing: string[];
  hint: string;
};

function present(env: EnvMap, name: string) {
  return Boolean(env[name]?.trim());
}

function missingNames(env: EnvMap, names: readonly string[]) {
  return names.filter((name) => !present(env, name));
}

export function stripeWebhookUrl(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/api/stripe/webhook`;
}

export function gmailRedirectUrl(appUrl: string) {
  return `${appUrl.replace(/\/$/, "")}/api/app/gmail/callback`;
}

export type StripeMode = "unset" | "test" | "live" | "unknown";

export function stripeMode(env: EnvMap): StripeMode {
  const key = env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (!key) return "unset";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  return "unknown";
}

function stripeHint(env: EnvMap, missing: string[]) {
  if (missing.length) {
    return "In Stripe Live mode, create a $29/month BizPilot Pro price, add the live webhook, activate Customer Portal, then paste the Live keys into Vercel.";
  }
  const mode = stripeMode(env);
  if (mode === "test") {
    return "Stripe Test mode is still on. Turn Test mode off, create a Live $29 price and live webhook, then replace STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_ID on Vercel.";
  }
  if (mode === "live") {
    return "Live Stripe is on. Checkout will charge real cards.";
  }
  return "Checkout and cancel can run against this Stripe account. Use an sk_live_ key to take real cards.";
}

export function operatorSetup(env: EnvMap = process.env): {
  items: OperatorCheck[];
  readyForSubscribers: boolean;
  readyForLiveCustomers: boolean;
  stripeMode: StripeMode;
} {
  const foundationMissing = missingNames(env, OPERATOR_FOUNDATION_VARS);
  const stripeMissing = missingNames(env, OPERATOR_STRIPE_VARS);
  const openaiMissing = missingNames(env, OPERATOR_OPENAI_VARS);
  const gmailMissing = missingNames(env, OPERATOR_GMAIL_VARS);
  const gmailReady =
    gmailMissing.length === 0 && present(env, "APP_URL") && present(env, "AUTH_SECRET");
  const mode = stripeMode(env);

  const items: OperatorCheck[] = [
    {
      key: "foundation",
      label: "Database, login cookies, and public site URL",
      required: true,
      done: foundationMissing.length === 0,
      missing: foundationMissing,
      hint:
        foundationMissing.length === 0
          ? "Signup and login can persist accounts on this deployment."
          : `Set ${foundationMissing.join(", ")} on Vercel Production, then redeploy.`,
    },
    {
      key: "stripe",
      label: "Live Stripe Checkout, webhook, and Customer Portal",
      required: true,
      done: stripeMissing.length === 0,
      missing: stripeMissing,
      hint: stripeHint(env, stripeMissing),
    },
    {
      key: "openai",
      label: "OpenAI key for AI replies",
      required: true,
      done: openaiMissing.length === 0,
      missing: openaiMissing,
      hint:
        openaiMissing.length === 0
          ? "Paid widget, email, and social drafts can call the model."
          : "Create a server-side OpenAI key and set OPENAI_API_KEY on Vercel Production.",
    },
    {
      key: "gmail",
      label: "Google OAuth for Connect Gmail",
      required: false,
      done: gmailReady,
      missing: gmailMissing,
      hint: gmailReady
        ? "Subscribers can connect their own Gmail from Email."
        : "Optional. Enable the Gmail API, add the redirect URI, then set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    },
  ];

  const readyForSubscribers = items.filter((item) => item.required).every((item) => item.done);

  return {
    items,
    readyForSubscribers,
    readyForLiveCustomers: readyForSubscribers && mode === "live",
    stripeMode: mode,
  };
}

export type StoreLiveKind = "live" | "test" | "setup";

export type StoreLiveStatus = {
  kind: StoreLiveKind;
  label: string;
  detail: string;
};

export function storeLiveStatus(input: {
  stripeMode: StripeMode;
  readyForLiveCustomers: boolean;
}): StoreLiveStatus {
  if (input.readyForLiveCustomers && input.stripeMode === "live") {
    return {
      kind: "live",
      label: "Live",
      detail: "This store is live. Checkout charges real cards.",
    };
  }
  if (input.stripeMode === "test") {
    return {
      kind: "test",
      label: "Test mode",
      detail: "This store is not live. Checkout will not charge real cards.",
    };
  }
  return {
    kind: "setup",
    label: "Not live",
    detail: "Finish Live Stripe on Vercel before this store can take real payments.",
  };
}
