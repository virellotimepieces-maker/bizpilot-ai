import { BIZPILOT_PRO } from "@/lib/plan";

export function formatPlanPriceUsd(amountCents = BIZPILOT_PRO.amountCents) {
  return `$${amountCents / 100}`;
}

export const LANDING_PRIMARY_CTA = {
  href: "/signup",
  label: `Get started — ${formatPlanPriceUsd()}/month`,
} as const;

export const LANDING_SECONDARY_CTA = {
  href: "#how-it-works",
  label: "See how it works",
} as const;

export const LANDING_DEMO = {
  href: "/demo",
  label: "Open the local demo",
} as const;

export const LANDING_SIGN_IN = {
  href: "/login",
  label: "Sign in",
} as const;

export const PUBLIC_BRAND_NAME = "Bizlyro";
export const PUBLIC_PRODUCT_NAME = "Bizlyro AI";
export const PUBLIC_MARK = "BL";
export const PUBLIC_ENTITY_STATEMENT =
  "Bizlyro AI is an AI customer service and sales assistant, and its official website is bizlyro.com.";

export const LANDING_HERO = {
  eyebrow: "Bizlyro · AI website assistant",
  title: "Capture Leads & Answer Customers 24/7 — Without Hiring a Front Desk.",
  subtitle:
    "Bizlyro is an AI website assistant that helps businesses answer customer questions and capture leads 24/7. It answers from your published knowledge. It does not invent prices, inventory, or confirmed appointments.",
  honest: "Honest AI — Never invents prices, policies, or business information.",
  entity: PUBLIC_ENTITY_STATEMENT,
  ctaSupport: `Creates your account, then you subscribe to Bizlyro AI for USD ${formatPlanPriceUsd()} per month. Cancel anytime.`,
  demoNote: `The demo is a browser-only preview. It is not a paid workspace and does not call an AI model or Stripe. Get started creates an account, then Bizlyro AI is ${formatPlanPriceUsd()} per month.`,
} as const;

export const HERO_OUTCOMES = [
  {
    title: "Answers questions 24/7",
    body: "The website widget replies from published knowledge when nobody is at the desk.",
  },
  {
    title: "Captures leads",
    body: "Name, email, quote, and appointment requests land in your workspace for you to review.",
  },
  {
    title: "Hands off to you",
    body: "Missing facts, complaints, and “talk to a person” wait in Inbox. Email is never sent for you.",
  },
] as const;

export const LANDING_NAV = [
  { href: "#product", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

export const LANDING_SECTIONS = [
  { id: "hero", title: "Hero" },
  { id: "problem", title: "The gap after hours" },
  { id: "solution", title: "What Bizlyro AI does" },
  { id: "product", title: "Product preview" },
  { id: "customer-service", title: "Customer service" },
  { id: "sales-assistant", title: "Sales assistant" },
  { id: "lead-capture", title: "Lead capture" },
  { id: "knowledge", title: "Knowledge engine" },
  { id: "inbox", title: "Inbox" },
  { id: "handoff", title: "Human handoff" },
  { id: "how-it-works", title: "How it works" },
  { id: "widget", title: "Website widget" },
  { id: "integrations", title: "Integrations" },
  { id: "analytics", title: "Analytics" },
  { id: "pricing", title: "Pricing" },
  { id: "faq", title: "FAQ" },
  { id: "final-cta", title: "Start" },
] as const;

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]["id"];

export const PRICING_FEATURES = [
  "One business workspace",
  "One installed website widget",
  `${BIZPILOT_PRO.replyLimit} AI-generated customer replies per billing month`,
  "Knowledge base that website chat answers from",
  "Inbox with human handoff when a person is needed",
  "Lead, quote, and appointment requests you review",
  "Gmail replies send only after you confirm",
  "Social drafts you approve before anything is published",
  "Cancel anytime",
  "No automatic overage charges",
] as const;

export const HOW_IT_WORKS_STEPS = [
  {
    step: "1",
    title: "Create an account",
    body: "Sign up with your name, business, and email. One workspace is created with the account.",
  },
  {
    step: "2",
    title: "Subscribe to Bizlyro AI",
    body: `${formatPlanPriceUsd()} per month unlocks the paid dashboard and widget. There is no free paid plan.`,
  },
  {
    step: "3",
    title: "Publish knowledge",
    body: "Add hours, services, policies, and FAQs. Chat answers only what you have published.",
  },
  {
    step: "4",
    title: "Install the widget",
    body: "Place one snippet on your site. Visitors chat there. You work from Inbox, Leads, and Knowledge.",
  },
] as const;

export const PROBLEM_POINTS = [
  {
    title: "Visitors still ask after you close",
    body: "Hours, pricing, and “can you do this?” arrive when nobody is at the desk.",
  },
  {
    title: "Contact forms go cold",
    body: "A form collects a name. It does not answer the question that made someone reach out.",
  },
  {
    title: "A 24/7 hire is the expensive version of this",
    body: "Bizlyro AI covers published questions around the clock. A person still handles what should not be automated.",
  },
] as const;

export const SOLUTION_POINTS = [
  {
    title: "Answers from your knowledge",
    body: "Website chat uses the facts you publish. If a fact is missing, it does not invent one.",
  },
  {
    title: "Captures the next step",
    body: "When a visitor shares contact details or asks for a quote or appointment, the request lands in your workspace for you to review.",
  },
  {
    title: "Hands off to you",
    body: "Complaints, legal or medical questions, “talk to a person,” and the monthly reply limit pause AI and wait in Inbox.",
  },
] as const;

export const CAPABILITY_SECTIONS = [
  {
    id: "customer-service" as const,
    title: "24/7 customer service on the site they already opened",
    body: "The widget answers hours, policies, and published FAQs in the visitor’s language when they write in that language. It is an always-on assistant for questions you have trained — not a promise that a person is available around the clock.",
  },
  {
    id: "sales-assistant" as const,
    title: "A sales assistant that stays inside your catalog",
    body: "Bizlyro AI can explain published products, services, and prices. It will not invent a discount, mark an item in stock, or close a sale you did not define.",
  },
  {
    id: "lead-capture" as const,
    title: "Leads, quotes, and appointment requests — not fake bookings",
    body: "Name, email, and the request show up in Leads. Quote rows are requests you review. A confirmed appointment is written to Google Calendar only after that workspace connects it and the visitor picks an open time.",
  },
] as const;

export const KNOWLEDGE_POINTS = [
  {
    title: "You write the source of truth",
    body: "Hours, offerings, policies, and FAQs live in Knowledge. Website chat answers from what is published there.",
  },
  {
    title: "Public pages can be indexed",
    body: "You can point Bizlyro AI at your public site so indexed pages sit beside the facts you typed. Conflicts stay visible instead of being silently merged.",
  },
  {
    title: "Unanswered questions stay on the record",
    body: "When chat cannot answer from knowledge, the gap is stored so you can publish the missing fact.",
  },
] as const;

export const INBOX_POINTS = [
  {
    title: "Website conversations in one queue",
    body: "Open threads, handoffs, and visitor messages stay in Inbox instead of a personal chat app.",
  },
  {
    title: "Gmail still needs your confirmation",
    body: "Connect Gmail to draft a reply from the incoming email. Send goes through that Gmail account only after you confirm. Email never auto-sends.",
  },
  {
    title: "Social posts wait for confirmation",
    body: "Drafts stay in Bizlyro AI until you approve them. Publishing runs only after that platform is connected and you confirm. Copy stays available when a platform is not set up.",
  },
] as const;

export const HANDOFF_POINTS = [
  {
    title: "Visitors can ask for a person",
    body: "“Talk to a person” pauses AI on that thread. The visitor is told a teammate will reply in the widget.",
  },
  {
    title: "Sensitive topics do not get a canned answer",
    body: "Complaints, legal, medical, and emergencies wait for Inbox instead of an invented policy.",
  },
  {
    title: "The 500-reply ceiling is a stop, not a surprise invoice",
    body: "When the monthly allowance is used, AI stops and the owner is notified. Visitors are offered a human. There is no overage charge.",
  },
] as const;

export const WIDGET_POINTS = [
  {
    title: "One widget per workspace",
    body: "Bizlyro AI includes one installed website widget. That is the customer surface.",
  },
  {
    title: "Safe questions, then a person",
    body: "Published questions can be answered directly. Everything else can wait in Inbox.",
  },
  {
    title: "Install with a snippet",
    body: "The paid Widget page gives you the script for your site. The public demo is a layout preview, not that installed widget.",
  },
] as const;

export const INTEGRATION_ITEMS = [
  {
    name: "Gmail",
    status: "Available",
    live: true,
    body: "Connect a mailbox. AI drafts a reply. You confirm before anything is sent.",
  },
  {
    name: "Social",
    status: "Drafts ready",
    live: true,
    body: "Create and approve drafts. A post is published only after you connect that account and confirm. Copy stays available.",
  },
  {
    name: "Shopify",
    status: "Not connected",
    live: false,
    body: "Not a live integration. Inventory and checkout are not read from Shopify.",
  },
  {
    name: "WooCommerce",
    status: "Not connected",
    live: false,
    body: "Not a live integration. Catalog data is not pulled from WooCommerce.",
  },
  {
    name: "Calendar",
    status: "Not connected",
    live: false,
    body: "Appointment rows are requests. Bizlyro AI does not confirm a slot on a calendar.",
  },
] as const;

export const ANALYTICS_POINTS = [
  {
    title: "Counts from stored workspace data",
    body: "Reply usage, waiting-on-human threads, and lead rows come from records in your workspace.",
  },
  {
    title: "No invented conversion rates",
    body: "The product does not estimate revenue, close rates, or “customers served this month” for marketing.",
  },
] as const;

export const WHO_IT_FITS = [
  "Independent shops and clinics that publish hours and services",
  "Service businesses that take quote or appointment requests",
  "Owners who want website chat without a 24/7 front desk",
] as const;

export const FAQ_ITEMS = [
  {
    id: "what-is-it",
    question: "What is Bizlyro AI?",
    answer:
      "Bizlyro AI is an AI customer service and sales assistant for one business. The official website is bizlyro.com. It includes website chat trained on your knowledge, an inbox, lead and request capture, Gmail drafts you confirm, and social drafts you approve before anything is published.",
    guide: { href: "/ai-business-assistant", label: "AI business assistant" },
  },
  {
    id: "free-plan",
    question: "Is there a free plan?",
    answer:
      "No. Get started creates an account, then you subscribe to Bizlyro AI for $29.99 per month. The local demo is a browser-only preview. It is not a free workspace and does not call an AI model or Stripe.",
  },
  {
    id: "limit",
    question: "What happens after 500 AI replies?",
    answer:
      "AI-generated customer replies pause for the rest of the Stripe billing month. The owner is notified. Visitors are offered a person. There is no automatic overage invoice.",
    guide: { href: "/ai-customer-service-assistant", label: "AI customer service assistant" },
  },
  {
    id: "email",
    question: "Does Bizlyro AI send email on its own?",
    answer:
      "No. If you connect Gmail, a reply is sent through that Gmail account only after you press Send reply and confirm. Email never auto-sends.",
    guide: { href: "/ai-business-assistant", label: "AI business assistant" },
  },
  {
    id: "appointments",
    question: "Will it book appointments for me?",
    answer:
      "If that workspace connects Google Calendar, the assistant checks real availability and books only a time the visitor confirms. Without a connected calendar, it can collect an appointment request and does not confirm a booking.",
    guide: { href: "/ai-sales-assistant", label: "AI sales assistant" },
  },
  {
    id: "prices",
    question: "Can it quote a price that is not in Knowledge?",
    answer:
      "No. It may use a price you published. If the price is missing, it should ask you rather than invent one.",
    guide: { href: "/ai-sales-assistant", label: "AI sales assistant" },
  },
  {
    id: "cancel",
    question: "Can I cancel?",
    answer:
      "Yes. Cancel anytime in Billing. Cancelling stops new AI replies. Stored knowledge and conversations remain until you ask us to delete the workspace.",
  },
  {
    id: "demo",
    question: "What is the demo?",
    answer:
      "A local, browser-only walkthrough of the desk layout. Knowledge stays in your browser. It is not billed and is not the paid widget your customers would use.",
    guide: { href: "/ai-chatbot-for-small-business", label: "AI chatbot for small business" },
  },
] as const;

export const HOME_METADATA = {
  title: "Bizlyro AI — AI Business Assistant for Customer Service & Sales",
  description:
    "Bizlyro AI is an AI business assistant for customer service and sales. It helps your website or store answer visitors, capture leads, and use your business knowledge.",
} as const;

export const PRODUCT_PREVIEW_LABEL = "Sample layout. Not live customer data.";
