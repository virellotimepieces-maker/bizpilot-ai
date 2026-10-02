import type { Metadata } from "next";
import { PRODUCTION_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { HOME_METADATA } from "./copy";

export const MARKETING_ORIGIN = PRODUCTION_PUBLIC_ORIGIN;

export const homeMetadata: Metadata = {
  title: HOME_METADATA.title,
  description: HOME_METADATA.description,
  alternates: { canonical: MARKETING_ORIGIN },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: MARKETING_ORIGIN,
    siteName: "BizPilot AI",
    title: HOME_METADATA.title,
    description: HOME_METADATA.description,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_METADATA.title,
    description: HOME_METADATA.description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export function publicSitemapUrls() {
  return ["", "/signup", "/login", "/demo", "/privacy", "/terms"].map((path) => ({
    url: `${MARKETING_ORIGIN}${path}`,
    lastModified: new Date("2026-10-02T00:00:00.000Z"),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));
}
