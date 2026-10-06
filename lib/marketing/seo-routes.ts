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

export type SeoRoute = (typeof SEO_ROUTES)[number];
export type SeoRoutePath = SeoRoute["path"];
