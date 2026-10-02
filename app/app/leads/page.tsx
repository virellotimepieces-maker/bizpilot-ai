import { DeskPlaceholderPage } from "@/components/desk-placeholder-page";
import { UserRoundPlus } from "lucide-react";

export default function LeadsPage() {
  return (
    <DeskPlaceholderPage
      eyebrow="Leads"
      title="Leads"
      description="Captured contacts, qualification status, and AI summaries will live here."
      icon={UserRoundPlus}
      emptyTitle="No leads stored yet"
      emptyDescription="This list is empty until the website widget captures a real contact. BizPilot will not invent names, emails, or conversion counts."
      action={{ href: "/app/widget", label: "Open widget" }}
    />
  );
}
