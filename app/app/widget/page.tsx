import { PaidWidget } from "@/components/paid-widget";
import { widgetDeskTab } from "@/lib/ui/desk-nav";

export default async function AppWidgetPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { tab } = await searchParams;
  return <PaidWidget initialTab={widgetDeskTab(tab)} />;
}
