import { SeoLanding } from "@/components/seo-landing";
import { seoPageByPath, seoPageMetadata } from "@/lib/marketing/seo-pages";

const page = seoPageByPath("/ai-business-assistant");

export const metadata = seoPageMetadata(page);

export default function AiBusinessAssistantPage() {
  return <SeoLanding page={page} />;
}
