import type { MetadataRoute } from "next";
import { requestPublicOrigin } from "@/lib/marketing/request-origin";
import { publicSitemapUrls } from "@/lib/marketing/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return publicSitemapUrls(await requestPublicOrigin());
}
