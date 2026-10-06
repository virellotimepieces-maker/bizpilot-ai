import { SeoLanding } from "@/components/seo-landing";
import { seoPageByPath, seoPageMetadata } from "@/lib/marketing/seo-pages";

const page = seoPageByPath("/ai-customer-service-assistant");

export const metadata = seoPageMetadata(page);

export default function AiCustomerServiceAssistantPage() {
  return <SeoLanding page={page} />;
}
