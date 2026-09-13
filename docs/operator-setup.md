# Operator setup — live BizPilot AI

The public product is https://www.mybizpilotai.com. Subscribers only sign up and pay. **You** set Live Stripe, OpenAI, and (optional) Google OAuth on **Vercel Production**. Never paste secret keys into chat or into this repo.

After each Vercel change, **Redeploy** Production.

Production `APP_URL` must be:

```
https://www.mybizpilotai.com
```

Use **Stripe Live mode** (toggle Test mode **off**). Test keys (`sk_test_`) cannot charge real cards.

---

## Phase 1 — Live Stripe (do this first)

This unlocks signup → Checkout → dashboard, and Cancel in Customer Portal, with real cards.

### 1. Product and price (Live mode)

1. Open [Stripe Dashboard](https://dashboard.stripe.com).
2. Turn **Test mode off** so the dashboard says Live.
3. Product catalog → **Add product**.
4. Name: `BizPilot Pro`. Description: one workspace, one website widget, 500 AI replies per month.
5. Pricing: **Recurring**, **$29.00 USD**, **Monthly**.
6. Save, then copy the Live Price ID (`price_…`). That is `STRIPE_PRICE_ID`. Do not hard-code it in the app.

### 2. Live secret key

1. Developers → API keys (still in Live mode).
2. Copy the **Secret key** (`sk_live_…`). That is `STRIPE_SECRET_KEY`.
3. Do not mix a live price with a test secret.

### 3. Live webhook

1. Developers → Webhooks → **Add endpoint**.
2. Endpoint URL:

```
https://www.mybizpilotai.com/api/stripe/webhook
```

3. Select these events only:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

4. Add endpoint, then reveal **Signing secret** (`whsec_…`). That is `STRIPE_WEBHOOK_SECRET`.
5. A Test-mode webhook secret will not unlock Live checkouts.

### 4. Live Customer Portal (required for Cancel)

1. Settings → Billing → Customer portal (Live mode).
2. Activate the portal.
3. Allow customers to cancel subscriptions and update payment methods.
4. Save.

Without this, **Manage in Stripe Customer Portal** on `/billing` fails.

### 5. Paste into Vercel

1. Vercel → this project → Settings → Environment Variables.
2. Set for **Production**:

| Variable | Example shape |
|---|---|
| `APP_URL` | `https://www.mybizpilotai.com` |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `STRIPE_PRICE_ID` | `price_…` |

3. Confirm `DATABASE_URL` and `AUTH_SECRET` are already set.
4. Deployments → Production → **Redeploy**.

### 6. Prove Live Checkout

1. Open https://www.mybizpilotai.com/signup
2. Create a throwaway account.
3. You land on `/billing`. Subscribe — $29 / month.
4. Pay with a real card (Live mode). Stripe may show 3D Secure.
5. After Checkout, `/billing` waits for the webhook, then `/app` unlocks.
6. Open Customer Portal from `/billing` and confirm you can cancel.

If Checkout succeeds but `/app` stays locked, the webhook URL, events, or `STRIPE_WEBHOOK_SECRET` is wrong.

Widget snippets now use `https://www.mybizpilotai.com`. Existing sites that still load the previous Vercel widget host continue to verify.

---

## Phase 2 — OpenAI (AI replies)

Needed for live widget, email, and social drafts after a subscriber is paid.

1. Open [OpenAI API keys](https://platform.openai.com/api-keys).
2. Create a secret key. That is `OPENAI_API_KEY`.
3. Optional: set `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
4. Paste into Vercel Production. Redeploy.

---

## Phase 3 — Gmail (optional)

Skip this until Live Stripe and OpenAI work. Subscribers connect **their** Gmail. You only configure Google OAuth once.

1. [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. Enable **Gmail API**.
3. OAuth consent screen. Scopes:

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`

4. Credentials → OAuth client ID → **Web application**.
5. Authorized JavaScript origins: `https://www.mybizpilotai.com`
6. Authorized redirect URIs:

```
https://www.mybizpilotai.com/api/app/gmail/callback
```

7. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on Vercel Production. Redeploy.
8. In a paid workspace, Email → Connect Gmail. Review drafts; email never auto-sends.
