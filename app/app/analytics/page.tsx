import { DeskPlaceholderPage } from "@/components/desk-placeholder-page";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <DeskPlaceholderPage
      eyebrow="Analytics"
      title="Analytics"
      description="Workspace metrics will use stored conversations, leads, handoffs, and AI usage only."
      icon={BarChart3}
      emptyTitle="No analytics to plot yet"
      emptyDescription="Charts stay empty until there is stored activity to count. This page does not show sample traffic or placeholder conversion rates."
      action={{ href: "/app", label: "Back to overview" }}
    />
  );
}
