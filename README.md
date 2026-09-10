# ReplyPilot AI

Customer support for **any** kind of business — not a store plugin.

ReplyPilot keeps one business knowledge base and uses it in two places:

- **Website chat** can answer safe, published questions on its own (hours, listed offerings, public prices, FAQs, policies).
- **Email support** always writes an **editable draft**. A human must approve it before anything is marked sent.

Online selling is one sample. The same product also includes a home-services company and a family clinic.

## Knowledge base

Every business can teach ReplyPilot:

- Business information
- Products and/or services
- Prices or rates
- Availability or operating hours
- Policies
- Frequently asked questions
- Custom knowledge and documents (public vs internal)
- Contact details
- Human-escalation rules

Type-specific fields stay hidden until they matter:

- **Online store:** shipping, stock language, payments, optional cash on delivery
- **Service business:** coverage area, booking lead time, emergency call-out
- **Clinic:** appointment booking, insurance, emergency protocol, no automated clinical advice

There are no required Shopify, inventory, shipping, or COD fields.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:43127](http://localhost:43127).

1. Pick a sample business (electrician, clinic, or outfitter) or start blank.
2. Edit the knowledge base.
3. Ask the website chat a published question, then an unsafe one.
4. Open **Email drafts**, edit a reply, and approve it. Nothing is sent outside the browser.

Answers are retrieved from the knowledge base you entered. No API key is required.

## Stack

Next.js, TypeScript, Tailwind CSS, and shadcn/ui. Workspace state is stored in `localStorage`.
