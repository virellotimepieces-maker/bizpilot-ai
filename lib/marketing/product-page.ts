import type { Metadata, ResolvingMetadata } from "next";
import { BIZPILOT_PRO } from "@/lib/plan";
import { BIZLYRO_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { INDUSTRY_DEMOS, type IndustryDemo } from "@/lib/industry-demos";
import {
  formatPlanPriceUsd,
  HOME_METADATA,
  HOW_IT_WORKS_STEPS,
  LANDING_PRIMARY_CTA,
  PUBLIC_ENTITY_STATEMENT,
  PUBLIC_PRODUCT_NAME,
} from "./copy";
import { BIZLYRO_SOFTWARE_ID, BIZLYRO_WEBSITE_ID, bizlyroEntityGraph } from "./site";

export const PRODUCT_PAGE_PATH = "/product";

export const PRODUCT_PAGE = {
  title: "Bizlyro AI Product — Website Answers and Leads",
  description:
    "Bizlyro AI answers published customer questions 24/7, stores the lead for the owner, and does not invent prices or policies. $29.99 per month.",
  eyebrow: "Product",
  h1: "Bizlyro AI for the owner who is also the front desk",
  lede:
    "Bizlyro AI is a website assistant for one business. It answers questions from the facts you publish, keeps a lead when someone wants a person, and leaves unknown prices, policies, promotions, and business facts unanswered.",
} as const;

export const PRODUCT_HONEST =
  "Honest AI never invents unknown prices, policies, promotions, or business facts.";

function demoHref(demo: IndustryDemo) {
  return `/demo?preset=${demo.presetId}`;
}

const contractorDemo = INDUSTRY_DEMOS.find((demo) => demo.id === "contractors");
const dentalDemo = INDUSTRY_DEMOS.find((demo) => demo.id === "dental");
const localDemo = INDUSTRY_DEMOS.find((demo) => demo.id === "local");
if (!contractorDemo || !dentalDemo || !localDemo) {
  throw new Error("Product page is missing an industry demo.");
}

export const PRODUCT_AUDIENCES = [
  {
    title: "Contractors and home services",
    body: "People ask if you cover their town and what a published visit costs while you are on a job. The sample shows a published rate and a refusal when the bid was never written down.",
    href: contractorDemo.landingPath,
    demoHref: demoHref(contractorDemo),
  },
  {
    title: "Dental clinics",
    body: "Patients ask about hours and how to request a visit after the front desk is with someone else. The sample repeats a published fee and does not invent a treatment price.",
    href: dentalDemo.landingPath,
    demoHref: demoHref(dentalDemo),
  },
  {
    title: "Local service businesses",
    body: "Neighbors ask whether you cover their street and what a published service costs. The sample answers from the listed area and does not invent a coupon.",
    href: localDemo.landingPath,
    demoHref: demoHref(localDemo),
  },
] as const;

export const PRODUCT_CAPABILITIES = [
  {
    title: "Answers customer questions 24/7",
    body: "The website widget can reply at any hour from the hours, services, and policies you published. It is not a claim that a person is on duty overnight.",
  },
  {
    title: "Captures leads",
    body: "When a visitor leaves a name and email, or asks for a quote or a callback, that request waits in the workspace for you to review. Bizlyro does not close the sale.",
  },
  {
    title: "Honest AI",
    body: PRODUCT_HONEST + " If a fact is missing, the assistant should say so and hand the thread to you.",
  },
  {
    title: "One website widget",
    body: "After you subscribe, the workspace gives you one install snippet for the site you already have. Visitors chat there. You do not send them to a separate app.",
  },
  {
    title: "Inbox and leads",
    body: "You review conversations, leads, and quote requests in the paid workspace. Email is not sent for you. A Gmail reply still waits until you confirm it. Social posts stay drafts until you publish them yourself.",
  },
] as const;

export const PRODUCT_FAQS = [
  {
    question: "What does Bizlyro AI cost?",
    answer: `Bizlyro AI is ${formatPlanPriceUsd()} per month for one business workspace, one website widget, and ${BIZPILOT_PRO.replyLimit} AI-generated customer replies in a billing month. Cancel anytime. There is no automatic overage charge and no free paid plan.`,
  },
  {
    question: "Will it invent a price or a promotion?",
    answer:
      "No. Honest AI repeats published facts only. An unpublished price, policy, promotion, or appointment time is not guessed. You answer that part yourself.",
  },
  {
    question: "What happens when I choose Get started?",
    answer:
      "Get started opens account creation. You then subscribe on the billing page. The paid dashboard, Leads desk, and widget install come after that subscription. The local demo does not call Stripe.",
  },
  {
    question: "Does the demo use my customers?",
    answer:
      "No. The contractor, dental, and local-business demos are sample data in the browser. Names and prices there are examples, not live customers.",
  },
  {
    question: "Does Bizlyro send email or post to social networks?",
    answer:
      "No. Inbox can hold a draft. Sending through a connected Gmail account still requires your confirmation. Social drafts are copied or published by you. Bizlyro does not post on its own.",
  },
] as const;

export const PRODUCT_LIMITS = [
  "Shopify and WooCommerce are not connected. Bizlyro does not read a live catalog or mark an item in stock.",
  "Calendar booking is not part of this product page. An appointment request is a request you review, not a reserved time.",
  "The assistant does not give medical, dental, or legal advice, and it does not diagnose.",
  "Workspace analytics count records stored for that account. They are not a public customer total.",
] as const;

type InheritedImages = NonNullable<Metadata["openGraph"]>["images"];

export function productPageMetadata(images?: InheritedImages): Metadata {
  const url = `${BIZLYRO_PUBLIC_ORIGIN}${PRODUCT_PAGE_PATH}`;
  return {
    title: PRODUCT_PAGE.title,
    description: PRODUCT_PAGE.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: PUBLIC_PRODUCT_NAME,
      title: PRODUCT_PAGE.title,
      description: PRODUCT_PAGE.description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: PRODUCT_PAGE.title,
      description: PRODUCT_PAGE.description,
      ...(images ? { images } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export async function productPageGenerateMetadata(parent: ResolvingMetadata): Promise<Metadata> {
  const images = (await parent).openGraph?.images;
  return productPageMetadata(images);
}

export function productPageJsonLd() {
  const url = `${BIZLYRO_PUBLIC_ORIGIN}${PRODUCT_PAGE_PATH}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      ...bizlyroEntityGraph(HOME_METADATA.description, {
        price: String(BIZPILOT_PRO.amountCents / 100),
        priceCurrency: BIZPILOT_PRO.currency.toUpperCase(),
        url: `${BIZLYRO_PUBLIC_ORIGIN}/signup`,
      }),
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: PRODUCT_PAGE.title,
        description: PRODUCT_PAGE.description,
        inLanguage: "en",
        isPartOf: { "@id": BIZLYRO_WEBSITE_ID },
        about: { "@id": BIZLYRO_SOFTWARE_ID },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        url,
        mainEntity: PRODUCT_FAQS.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };
}

export const PRODUCT_PRIMARY_CTA = LANDING_PRIMARY_CTA;
export const PRODUCT_ENTITY = PUBLIC_ENTITY_STATEMENT;
export const PRODUCT_SETUP_STEPS = HOW_IT_WORKS_STEPS;
export const PRODUCT_PRICE_LABEL = formatPlanPriceUsd();
