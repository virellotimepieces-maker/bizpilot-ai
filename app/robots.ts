import type { MetadataRoute } from "next";
import { requestPublicOrigin } from "@/lib/marketing/request-origin";
import { marketingRobots } from "@/lib/marketing/site";

export default async function robots(): Promise<MetadataRoute.Robots> {
  return marketingRobots(await requestPublicOrigin());
}
