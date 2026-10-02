import type { MetadataRoute } from "next";
import { publicSitemapUrls } from "@/lib/marketing/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicSitemapUrls();
}
