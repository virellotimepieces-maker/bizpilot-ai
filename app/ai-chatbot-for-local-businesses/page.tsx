import type { ResolvingMetadata } from "next";
import { SeoLanding } from "@/components/seo-landing";
import { seoPageByPath, seoPageGenerateMetadata } from "@/lib/marketing/seo-pages";

const page = seoPageByPath("/ai-chatbot-for-local-businesses");

export function generateMetadata(_props: unknown, parent: ResolvingMetadata) {
  return seoPageGenerateMetadata(page, parent);
}

export default function AiChatbotForLocalBusinessesPage() {
  return <SeoLanding page={page} />;
}