import type { Metadata, ResolvingMetadata } from "next";
import { BIZPILOT_PRO } from "@/lib/plan";
import { BIZLYRO_PUBLIC_ORIGIN } from "@/lib/public-origin";
import {
  formatPlanPriceUsd,
  HOME_METADATA,
  LANDING_PRIMARY_CTA,
  PUBLIC_ENTITY_STATEMENT,
  PUBLIC_PRODUCT_NAME,
} from "./copy";
import { BIZLYRO_SOFTWARE_ID, BIZLYRO_WEBSITE_ID, bizlyroEntityGraph } from "./site";

export const ABOUT_PAGE_PATH = "/about";

export const ABOUT_PAGE = {
  title: "About Bizlyro AI — Answers and Leads for One Business",
  description:
    "About Bizlyro AI: a website widget that answers published questions 24/7, captures leads, and does not invent prices, policies, or availability. $29.99 per month.",
  eyebrow: "About",
  h1: "About Bizlyro",
  lede:
    "Bizlyro AI helps a small business answer customer questions on the website it already has, and keep the lead when the owner is away from the desk.",
} as const;

export const ABOUT_HONEST =
  "It should not invent business facts, prices, policies, or availability.";

export const ABOUT_WHY = [
  {
    title: "It does not invent missing business information",
    body: "Honest AI repeats what you published. If a price, policy, promotion, availability, or other business fact is missing, Bizlyro should say so instead of guessing.",
  },
  {
    title: "It helps capture leads when you are unavailable",
    body: "A visitor can leave a name, email, and request when you are unavailable — on a job, with a patient, or closed. The lead waits for you. Bizlyro does not close the sale.",
  },
  {
    title: "It works on the website you already have",
    body: "After you subscribe, you install one widget snippet on the website you already have. Visitors stay on that page. There is no separate app for them to download.",
  },
  {
    title: "You can review the conversations and leads",
    body: "The paid workspace lets you review the conversations and leads. Email is not sent for you. You confirm a Gmail reply before it goes out, and you publish any social draft yourself.",
  },
] as const;

export const ABOUT_FOR = [
  {
    title: "Contractors and home services",
    body: "Service-area and published-rate questions arrive while you are on a job. The widget can repeat those facts and store the estimate request.",
  },
  {
    title: "Dental clinics",
    body: "Patients ask about hours and how to request a visit. Bizlyro can repeat published clinic facts. It does not give dental advice or invent a fee.",
  },
  {
    title: "Other local businesses",
    body: "Hours, place, and a published service price are the questions neighbors ask. If the fact is not written down, the assistant should not fill it in.",
  },
] as const;

export function aboutPageMetadata(images?: NonNullable<Metadata["openGraph"]>["images"]): Metadata {
  const url = `${BIZLYRO_PUBLIC_ORIGIN}${ABOUT_PAGE_PATH}`;
  return {
    title: ABOUT_PAGE.title,
    description: ABOUT_PAGE.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_US",
      url,
      siteName: PUBLIC_PRODUCT_NAME,
      title: ABOUT_PAGE.title,
      description: ABOUT_PAGE.description,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ABOUT_PAGE.title,
      description: ABOUT_PAGE.description,
      ...(images ? { images } : {}),
    },
    robots: { index: true, follow: true },
  };
}

export async function aboutPageGenerateMetadata(parent: ResolvingMetadata): Promise<Metadata> {
  const images = (await parent).openGraph?.images;
  return aboutPageMetadata(images);
}

export function aboutPageJsonLd() {
  const url = `${BIZLYRO_PUBLIC_ORIGIN}${ABOUT_PAGE_PATH}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      ...bizlyroEntityGraph(HOME_METADATA.description, {
        price: String(BIZPILOT_PRO.amountCents / 100),
        priceCurrency: BIZPILOT_PRO.currency.toUpperCase(),
        url: `${BIZLYRO_PUBLIC_ORIGIN}/signup`,
      }),
      {
        "@type": "AboutPage",
        "@id": `${url}#webpage`,
        url,
        name: ABOUT_PAGE.title,
        description: ABOUT_PAGE.description,
        inLanguage: "en",
        isPartOf: { "@id": BIZLYRO_WEBSITE_ID },
        about: { "@id": BIZLYRO_SOFTWARE_ID },
      },
    ],
  };
}

export const ABOUT_PRIMARY_CTA = LANDING_PRIMARY_CTA;
export const ABOUT_ENTITY = PUBLIC_ENTITY_STATEMENT;
export const ABOUT_PRICE_LABEL = formatPlanPriceUsd();
export const ABOUT_REPLY_LIMIT = BIZPILOT_PRO.replyLimit;
