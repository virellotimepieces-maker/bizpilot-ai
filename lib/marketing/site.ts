import type { Metadata, MetadataRoute } from "next";
import { BIZLYRO_PUBLIC_ORIGIN, PRODUCTION_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { HOME_METADATA } from "./copy";

export const MARKETING_ORIGIN = PRODUCTION_PUBLIC_ORIGIN;

export const homeMetadata: Metadata = {
  title: HOME_METADATA.title,
  description: HOME_METADATA.description,
  alternates: { canonical: BIZLYRO_PUBLIC_ORIGIN },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: BIZLYRO_PUBLIC_ORIGIN,
    siteName: "Bizlyro AI",
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

export function publicSitemapUrls(origin: string = MARKETING_ORIGIN) {
  const base = origin.replace(/\/$/, "");
  return ["", "/signup", "/login", "/demo", "/privacy", "/terms"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date("2026-10-02T00:00:00.000Z"),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1 : 0.6,
  }));
}

function escapeSitemapXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sitemapXml(origin: string = MARKETING_ORIGIN) {
  const urls = publicSitemapUrls(origin)
    .map((entry) => {
      const lastmod = entry.lastModified.toISOString().slice(0, 10);
      return `<url><loc>${escapeSitemapXml(entry.url)}</loc><lastmod>${lastmod}</lastmod><changefreq>${entry.changeFrequency}</changefreq><priority>${entry.priority.toFixed(1)}</priority></url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

export function marketingRobots(origin: string = MARKETING_ORIGIN): MetadataRoute.Robots {
  const base = origin.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/app/", "/account", "/billing", "/embed/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
