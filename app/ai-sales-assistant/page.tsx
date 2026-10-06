import type { ResolvingMetadata } from "next";
import { SeoLanding } from "@/components/seo-landing";
import { seoPageByPath, seoPageGenerateMetadata } from "@/lib/marketing/seo-pages";

const page = seoPageByPath("/ai-sales-assistant");

export function generateMetadata(_props: unknown, parent: ResolvingMetadata) {
  return seoPageGenerateMetadata(page, parent);
}

export default function AiSalesAssistantPage() {
  return <SeoLanding page={page} />;
}
