# Operator setup (you, not subscribers)

BizPilot AI is already deployed at https://www.mybizpilotai.com. Subscribers only sign up and pay. **You** set Stripe, OpenAI, and (optional) Google OAuth on **Vercel Production**. Never paste secret keys into chat or into this repo.

Do the phases in order. After each Vercel change, **Redeploy** Production so the new values load.

Production `APP_URL` must be:

```
https://www.mybizpilotai.com
```

---

## Phase 1 — Stripe (start here)

This unlocks signup → Checkout → dashboard, and Cancel in Customer Portal.

### 1. Product and price

1. Open [Stripe Dashboard](https://dashboard.stripe.com).
2. Use **Test mode** first if nobody has paid yet. Switch to **Live mode** only when you are ready to take real cards.
3. Product catalog → **Add product**.
4. Name: `BizPilot Pro`. Description: one workspace, one website widget, 500 AI replies per month.
5. Pricing: **Recurring**, **$29.00 USD**, **Monthly**.
6. Save, then copy the Price ID (`price_…`). That is `STRIPE_PRICE_ID`. Do not hard-code it in the app.

### 2. Secret key

1. Developers → API keys.
2. Copy the **Secret key** (`sk_test_…` in Test mode, `sk_live_…` in Live mode).
3. That is `STRIPE_SECRET_KEY`. Keep Test and Live keys on matching Stripe modes. Do not mix a live price with a test secret.

### 3. Webhook

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
5. If you later switch Test → Live, create a **new** live webhook and a new `whsec_…`.

### 4. Customer Portal (required for Cancel)

1. Settings → Billing → Customer portal.
2. Activate the portal.
3. Allow customers to cancel subscriptions and update payment methods.
4. Save.

Without this, **Manage in Stripe Customer Portal** on `/billing` fails.

### 5. Paste into Vercel

1. Vercel → this project → Settings → Environment Variables.
2. Set for **Production** (and Preview if you test preview deploys):

| Variable | Example shape |
|---|---|
| `APP_URL` | `https://www.mybizpilotai.com` |
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `STRIPE_PRICE_ID` | `price_…` |

3. Confirm `DATABASE_URL` and `AUTH_SECRET` are already set.
4. Deployments → Production → **Redeploy**.

### 6. Prove Phase 1

1. Open https://www.mybizpilotai.com/signup
2. Create a throwaway account.
3. You land on `/billing`. Subscribe — $29 / month.
4. Pay with a [Stripe test card](https://docs.stripe.com/testing) in Test mode (`4242 4242 4242 4242`), or a real card in Live mode.
5. After Checkout, `/billing` waits for the webhook, then `/app` unlocks.
6. Open Customer Portal from `/billing` and confirm you can cancel.

If Checkout succeeds but `/app` stays locked, the webhook URL, events, or `STRIPE_WEBHOOK_SECRET` is wrong.

---

## Phase 2 — OpenAI (AI replies)

1. Open [OpenAI API keys](https://platform.openai.com/api-keys).
2. Create a secret key. That is `OPENAI_API_KEY`.
3. Optional: set `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
4. Paste into Vercel Production. Redeploy.
5. In a paid workspace, install the widget or send a Gmail/social draft. AI replies stop at 500 per billing month.

---

## Phase 3 — Gmail (optional)

Skip this until Stripe and OpenAI work. Subscribers connect **their** Gmail. You only configure Google OAuth once.

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

---

## After Live mode

When Test mode works, repeat Phase 1 in **Live** Stripe: new live price, live secret, live webhook signing secret, then replace the three Stripe variables on Vercel and redeploy. Use the live Customer Portal settings in Live mode.
