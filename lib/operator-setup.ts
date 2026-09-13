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

export function operatorSetup(env: EnvMap = process.env): {
  items: OperatorCheck[];
  readyForSubscribers: boolean;
} {
  const foundationMissing = missingNames(env, OPERATOR_FOUNDATION_VARS);
  const stripeMissing = missingNames(env, OPERATOR_STRIPE_VARS);
  const openaiMissing = missingNames(env, OPERATOR_OPENAI_VARS);
  const gmailMissing = missingNames(env, OPERATOR_GMAIL_VARS);
  const gmailReady =
    gmailMissing.length === 0 && present(env, "APP_URL") && present(env, "AUTH_SECRET");

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
      label: "Stripe Checkout, webhook, and Customer Portal",
      required: true,
      done: stripeMissing.length === 0,
      missing: stripeMissing,
      hint:
        stripeMissing.length === 0
          ? "Checkout and cancel can run against this Stripe account."
          : "Create a $29/month BizPilot Pro price, add the webhook, activate Customer Portal, then paste the keys into Vercel.",
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

  return {
    items,
    readyForSubscribers: items.filter((item) => item.required).every((item) => item.done),
  };
}
