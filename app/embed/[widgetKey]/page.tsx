import { WidgetChat } from "@/components/widget-chat";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ widgetKey: string }>;
}) {
  const { widgetKey } = await params;
  return <WidgetChat widgetKey={widgetKey} />;
}
