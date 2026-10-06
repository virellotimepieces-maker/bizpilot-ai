/** Public use-case routes. Keep labels short so the homepage and footer can link here. */
export const SEO_ROUTES = [
  {
    path: "/ai-customer-service-assistant",
    label: "AI customer service assistant",
    blurb:
      "After-hours support from published hours and policies, and when a person takes the thread.",
    homeSectionId: "customer-service",
  },
  {
    path: "/ai-sales-assistant",
    label: "AI sales assistant",
    blurb:
      "Published products and services, quote requests, and sales questions without an invented discount.",
    homeSectionId: "sales-assistant",
  },
  {
    path: "/ai-business-assistant",
    label: "AI business assistant",
    blurb:
      "The Bizlyro AI workspace for website answers, leads, and drafts you confirm.",
    homeSectionId: "product",
  },
  {
    path: "/ai-chatbot-for-small-business",
    label: "AI chatbot for small business",
    blurb:
      "How a small business publishes its facts and installs one website widget.",
    homeSectionId: "widget",
  },
] as const;

/** High-intent pages. Linked from the footer and from related guides, not from homepage section anchors. */
export const INTENT_ROUTES = [
  {
    path: "/ai-customer-service-for-small-business",
    label: "AI customer service for small business",
    blurb: "Published answers for the owner who is also the support desk, plus the leads that need a person.",
  },
  {
    path: "/ai-website-chatbot-for-small-business",
    label: "AI website chatbot for small business",
    blurb: "A chat on the site visitors already opened, answering from your pages and capturing the next step.",
  },
  {
    path: "/ai-lead-capture-for-small-business",
    label: "AI lead capture for small business",
    blurb: "Answer the published question, then keep the name, email, and request for you to review.",
  },
  {
    path: "/ai-chatbot-for-contractors",
    label: "AI chatbot for contractors",
    blurb: "Service-area questions and estimate requests while you are on a job, without an invented price.",
  },
  {
    path: "/ai-chatbot-for-dental-clinics",
    label: "AI chatbot for dental clinics",
    blurb: "Clinic hours and published visit facts for the front desk, without dental advice or invented fees.",
  },
  {
    path: "/ai-chatbot-for-local-businesses",
    label: "AI chatbot for local businesses",
    blurb: "Hours, place, and service-area answers for a business people found nearby.",
  },
] as const;

export type SeoRoute = (typeof SEO_ROUTES)[number];
export type IntentRoute = (typeof INTENT_ROUTES)[number];
export type SeoRoutePath = SeoRoute["path"] | IntentRoute["path"];
