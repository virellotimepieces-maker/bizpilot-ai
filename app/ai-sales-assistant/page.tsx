import { SeoLanding } from "@/components/seo-landing";
import { seoPageByPath, seoPageMetadata } from "@/lib/marketing/seo-pages";

const page = seoPageByPath("/ai-sales-assistant");

export const metadata = seoPageMetadata(page);

export default function AiSalesAssistantPage() {
  return <SeoLanding page={page} />;
}
