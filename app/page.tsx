import { MarketingHome } from "@/components/marketing-home";
import { homeMetadata } from "@/lib/marketing/site";

export const metadata = homeMetadata;

export default function HomePage() {
  return <MarketingHome />;
}
