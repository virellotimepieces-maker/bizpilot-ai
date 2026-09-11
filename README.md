# BizPilot AI

Customer support for one business at a time, billed as **BizPilot Pro**.

## Two modes (keep them separate)

- **Demo (`/demo`)** — browser-only preview. Knowledge lives in `localStorage`. Chat uses deterministic matching, not an AI model. It is not a customer workspace and cannot take a subscription.
- **Paid (`/signup` → Stripe → `/app`)** — one business workspace, one website widget, and 500 AI customer replies per Stripe billing month. Requires a PostgreSQL database, Stripe, and an OpenAI key. **Not production-ready until those credentials are set and the signup → payment → widget → AI → cancellation path is proven end-to-end.**

## BizPilot Pro

- **USD $29 / month**
- One business workspace
- One installed website widget
- 500 AI-generated customer replies per billing month
- Knowledge base, conversation inbox, email drafts, and social drafts (copy and post yourself)
- Instagram, Facebook, TikTok, and Messenger are not live-connected — there is no auto-post
- Cancel anytime
- No automatic overage charges
- When the 500-reply limit is reached, AI replies stop and the owner is notified

Stripe Product/Price IDs are never hard-coded. Create a recurring monthly Price at $29 in a **new** Stripe account or catalog for this app, then set `STRIPE_PRICE_ID`.

## Required environment variables

Copy `.env.example` to `.env.local`. Use a **new** database and **new** Stripe keys for this project. Do not reuse another app’s credentials.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL for users, workspaces, memberships, subscriptions, usage |
| `AUTH_SECRET` | Signs login cookies (32+ random characters) |
| `APP_URL` | Public origin for Stripe redirects and the widget snippet |
| `STRIPE_SECRET_KEY` | Stripe secret key for this BizPilot project |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret for `POST /api/stripe/webhook` |
| `STRIPE_PRICE_ID` | Recurring monthly Price id (`price_…`) for $29 BizPilot Pro |
| `STRIPE_PUBLISHABLE_KEY` | Optional |
| `OPENAI_API_KEY` | Paid widget AI replies |
| `OPENAI_MODEL` | Optional, defaults to `gpt-4o-mini` |
| `CRON_SECRET` | Optional. Protects `/api/cron/website-sync` if you call it yourself. Vercel Cron is also accepted. |

After `DATABASE_URL` is set on Vercel Production, `npm run build` runs `prisma migrate deploy` against that Neon database only.

```bash
npx prisma migrate deploy
```

Point Stripe webhooks to `https://YOUR_DOMAIN/api/stripe/webhook` for:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43127](http://localhost:43127).

- `/` marketing and pricing
- `/demo` local demo desk (no billing, no AI)
- `/demo/social` paste Instagram, Facebook, TikTok, or Messenger messages into drafts (never auto-posted)
- `/signup` and `/login` paid accounts (need `DATABASE_URL` + `AUTH_SECRET`)
- `/billing` Stripe Checkout and Customer Portal
- `/app` paid dashboard (blocked unless the subscription is active)

On Knowledge, paid workspaces can verify a public domain and click **Sync website**. Domain verification follows HTTPS redirects to the live homepage, then matches the workspace widget script by origin and pathname (query parameters such as `?v=` are ignored). Sync reads `sitemap.xml` recursively (Shopify product, collection, page, and blog sitemaps, including gzip and query-string child sitemaps), always crawls public `/policies/*` URLs, skips cart/checkout/account/search/admin/preview URLs, and answers only from that subscriber’s indexed pages. A sync that indexes 0 pages is reported as a failure. Verified sites re-sync daily via `/api/cron/website-sync`.

```bash
npm test
npm run typecheck
npm run lint
```

## Status

The subscription **foundation** (schema, auth, Stripe webhook handling, usage limits, tenant isolation, tests) is in the repo. Production billing and AI replies stay **paused** until the environment variables above are provided and the full path is verified against live Stripe and a live database.
