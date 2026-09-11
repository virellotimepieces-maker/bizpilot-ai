import { BIZPILOT_PRO } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";

const FEATURES = [
  "One business workspace",
  "One installed website widget",
  `${BIZPILOT_PRO.replyLimit} AI-generated customer replies per billing month`,
  "Knowledge base, website chat, email drafts, and social drafts",
  "Cancel anytime",
  "No automatic overage charges",
];

export function MarketingHome() {
  return (
    <div className="min-h-full">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-12 sm:px-6">
        <section className="max-w-3xl">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Customer support for one business
          </p>
          <h1 className="font-heading mt-3 text-4xl tracking-tight sm:text-5xl">
            Website chat that answers from your knowledge — billed as BizPilot Pro.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Subscribe for one workspace, one widget, and {BIZPILOT_PRO.replyLimit} AI replies each
            month. When the allowance is used, AI stops and the owner is notified. There is no
            overage invoice. Email and social replies are drafts you send or post yourself.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" render={<Link href="/signup" />}>
              Start BizPilot Pro
            </Button>
            <Button size="lg" variant="outline" render={<Link href="/demo" />}>
              Open the local demo
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The demo is a browser-only preview. It is not a paid workspace and does not call an AI
            model or Stripe.
          </p>
        </section>

        <Card className="max-w-lg">
          <CardHeader className="border-b">
            <CardTitle>{BIZPILOT_PRO.name}</CardTitle>
            <CardDescription>Per business, billed monthly in USD.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <p className="font-heading text-4xl">
              $29
              <span className="text-base font-sans text-muted-foreground"> / month</span>
            </p>
            <ul className="mt-4 grid gap-2">
              {FEATURES.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 size-4 text-primary" />
                  {item}
                </li>
              ))}
            </ul>
            <Button className="mt-5" render={<Link href="/signup" />}>
              Create an account
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
