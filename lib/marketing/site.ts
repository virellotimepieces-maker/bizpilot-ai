import type { Metadata, MetadataRoute } from "next";
import { BIZLYRO_PUBLIC_ORIGIN, PRODUCTION_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { HOME_METADATA, PUBLIC_BRAND_NAME, PUBLIC_PRODUCT_NAME } from "./copy";
import { SEO_ROUTES } from "./seo-routes";

export const BIZLYRO_ORGANIZATION_ID = `${BIZLYRO_PUBLIC_ORIGIN}/#organization`;
export const BIZLYRO_WEBSITE_ID = `${BIZLYRO_PUBLIC_ORIGIN}/#website`;
export const BIZLYRO_SOFTWARE_ID = `${BIZLYRO_PUBLIC_ORIGIN}/#software`;

export function bizlyroEntityGraph(
  description: string,
  offer?: { price: string; priceCurrency: string; url: string },
) {
  const software: Record<string, unknown> = {
    "@type": "SoftwareApplication",
    "@id": BIZLYRO_SOFTWARE_ID,
    name: PUBLIC_PRODUCT_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: BIZLYRO_PUBLIC_ORIGIN,
    description,
    provider: { "@id": BIZLYRO_ORGANIZATION_ID },
  };
  if (offer) {
    software.offers = {
      "@type": "Offer",
      price: offer.price,
      priceCurrency: offer.priceCurrency,
      url: offer.url,
    };
  }
  return [
    {
      "@type": "Organization",
      "@id": BIZLYRO_ORGANIZATION_ID,
      name: PUBLIC_BRAND_NAME,
      url: BIZLYRO_PUBLIC_ORIGIN,
      description,
    },
    {
      "@type": "WebSite",
      "@id": BIZLYRO_WEBSITE_ID,
      name: PUBLIC_PRODUCT_NAME,
      url: BIZLYRO_PUBLIC_ORIGIN,
      description,
      publisher: { "@id": BIZLYRO_ORGANIZATION_ID },
    },
    software,
  ];
}

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

/** Date the four Bizlyro guide pages were rewritten. Other marketing URLs keep their earlier date. */
export const GUIDE_SITEMAP_LAST_MODIFIED = "2026-10-06T00:00:00.000Z";

const SITEMAP_PATHS: { path: string; priority: number; lastModified: string; guide?: boolean }[] = [
  { path: "", priority: 1, lastModified: "2026-10-02T00:00:00.000Z" },
  { path: "/signup", priority: 0.6, lastModified: "2026-10-02T00:00:00.000Z" },
  { path: "/login", priority: 0.6, lastModified: "2026-10-02T00:00:00.000Z" },
  { path: "/demo", priority: 0.6, lastModified: "2026-10-02T00:00:00.000Z" },
  { path: "/privacy", priority: 0.6, lastModified: "2026-10-02T00:00:00.000Z" },
  { path: "/terms", priority: 0.6, lastModified: "2026-10-02T00:00:00.000Z" },
  ...SEO_ROUTES.map((route) => ({
    path: route.path,
    priority: 0.8,
    lastModified: GUIDE_SITEMAP_LAST_MODIFIED,
    guide: true,
  })),
];

export function publicSitemapUrls(origin: string = MARKETING_ORIGIN) {
  const base = origin.replace(/\/$/, "");
  const entries = base === BIZLYRO_PUBLIC_ORIGIN ? SITEMAP_PATHS : SITEMAP_PATHS.filter((entry) => !entry.guide);
  return entries.map((entry) => ({
    url: `${base}${entry.path}`,
    lastModified: new Date(entry.lastModified),
    changeFrequency: "weekly" as const,
    priority: entry.priority,
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
