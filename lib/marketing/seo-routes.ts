/** Public use-case routes. Keep labels short so the homepage and footer can link here. */
export const SEO_ROUTES = [
  {
    path: "/ai-customer-service-assistant",
    label: "AI customer service assistant",
    blurb:
      "How Bizlyro answers published support questions, and when a person takes the thread.",
    homeSectionId: "customer-service",
  },
  {
    path: "/ai-sales-assistant",
    label: "AI sales assistant",
    blurb:
      "How Bizlyro explains published offers, captures quote requests, and avoids invented discounts.",
    homeSectionId: "sales-assistant",
  },
  {
    path: "/ai-business-assistant",
    label: "AI business assistant",
    blurb:
      "How one Bizlyro workspace covers website answers, leads, and drafts you confirm.",
    homeSectionId: "product",
  },
  {
    path: "/ai-chatbot-for-small-business",
    label: "AI chatbot for small business",
    blurb:
      "How a small business publishes facts once and installs a single website chatbot.",
    homeSectionId: "widget",
  },
] as const;

export type SeoRoute = (typeof SEO_ROUTES)[number];
export type SeoRoutePath = SeoRoute["path"];
