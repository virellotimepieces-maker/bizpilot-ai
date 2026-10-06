import { SeoLanding } from "@/components/seo-landing";
import { seoPageByPath, seoPageMetadata } from "@/lib/marketing/seo-pages";

const page = seoPageByPath("/ai-chatbot-for-small-business");

export const metadata = seoPageMetadata(page);

export default function AiChatbotForSmallBusinessPage() {
  return <SeoLanding page={page} />;
}