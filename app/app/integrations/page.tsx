import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_SHELL_CLASS, HELPER_TEXT_CLASS } from "@/lib/ui/type-scale";
import Link from "next/link";

const FUTURE = [
  { name: "Shopify", detail: "Product catalog sync is not connected." },
  { name: "WooCommerce", detail: "Order support is not connected." },
  { name: "Calendar", detail: "Appointment confirmation is not connected." },
] as const;

export default function IntegrationsPage() {
  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader
        eyebrow="Integrations"
        title="Integrations"
        description="Only Gmail and social drafts are available today. Future commerce and calendar connections stay listed as not connected."
      />
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gmail</CardTitle>
            <CardDescription>Connected inboxes still require you to confirm AI drafts before send.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <p className={HELPER_TEXT_CLASS}>
              OAuth, draft generation, and send confirmation are unchanged from the live product.
            </p>
            <Button size="sm" render={<Link href="/app/email" />}>
              Open Gmail drafts
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Social drafts</CardTitle>
            <CardDescription>Drafts wait for you. BizPilot does not post on your behalf.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href="/app/social" />}>
              Open social drafts
            </Button>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {FUTURE.map((item) => (
          <Card key={item.name}>
            <CardHeader>
              <CardTitle>{item.name}</CardTitle>
              <CardDescription>Not connected</CardDescription>
            </CardHeader>
            <CardContent>
              <p className={HELPER_TEXT_CLASS}>{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
