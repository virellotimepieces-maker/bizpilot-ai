import { WidgetChat } from "@/components/widget-chat";

export default async function EmbedPage({
  params,
}: {
  params: Promise<{ widgetKey: string }>;
}) {
  const { widgetKey } = await params;
  return (
    <div className="h-full">
      <WidgetChat widgetKey={widgetKey} />
    </div>
  );
}
