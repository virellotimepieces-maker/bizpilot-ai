import { MarketingFaq } from "@/components/marketing-faq";
import { ProductPreview } from "@/components/product-preview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ANALYTICS_POINTS,
  CAPABILITY_SECTIONS,
  HANDOFF_POINTS,
  HERO_OUTCOMES,
  HOME_METADATA,
  HOW_IT_WORKS_STEPS,
  INBOX_POINTS,
  INTEGRATION_ITEMS,
  KNOWLEDGE_POINTS,
  LANDING_DEMO,
  LANDING_HERO,
  PUBLIC_PRODUCT_NAME,
  LANDING_PRIMARY_CTA,
  LANDING_SECONDARY_CTA,
  PROBLEM_POINTS,
  PRICING_FEATURES,
  SOLUTION_POINTS,
  WHO_IT_FITS,
  WIDGET_POINTS,
  formatPlanPriceUsd,
} from "@/lib/marketing/copy";
import { SEO_ROUTES } from "@/lib/marketing/seo-routes";
import { bizlyroEntityGraph } from "@/lib/marketing/site";
import { BIZLYRO_PUBLIC_ORIGIN } from "@/lib/public-origin";
import { BIZPILOT_PRO } from "@/lib/plan";
import { ArrowRight, Check, Inbox, MessageSquare, ShieldCheck, UserRoundPlus } from "lucide-react";
import Link from "next/link";

const sectionClass = "scroll-mt-24";
const wrapClass = "mx-auto w-full min-w-0 max-w-6xl px-4 sm:px-6";

const OUTCOME_ICONS = [MessageSquare, UserRoundPlus, Inbox] as const;

function CtaPair({ className = "" }: { className?: string }) {
  return (
    <div className={`flex min-w-0 flex-wrap gap-3 ${className}`}>
      <Button
        size="lg"
        className="px-4 shadow-sm sm:px-5"
        nativeButton={false}
        render={<Link href={LANDING_PRIMARY_CTA.href} />}
      >
        {LANDING_PRIMARY_CTA.label}
        <ArrowRight aria-hidden />
      </Button>
      <Button size="lg" variant="outline" nativeButton={false} render={<a href={LANDING_SECONDARY_CTA.href} />}>
        {LANDING_SECONDARY_CTA.label}
      </Button>
    </div>
  );
}

function HonestAiNote({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex min-w-0 items-start gap-3 rounded-xl border border-primary/25 bg-card px-4 py-3 shadow-[0_1px_2px_oklch(0.22_0.03_264/0.06)] ${className}`}
    >
      <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 text-sm font-semibold leading-relaxed text-foreground sm:text-base">
        {LANDING_HERO.honest}
      </p>
    </div>
  );
}

function SectionGuide({ sectionId }: { sectionId: string }) {
  const route = SEO_ROUTES.find((item) => item.homeSectionId === sectionId);
  if (!route) return null;
  return (
    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
      <Link className="font-medium text-foreground underline-offset-2 hover:underline" href={route.path}>
        {route.label}
      </Link>
      {". "}
      {route.blurb}
    </p>
  );
}

function PointGrid({
  items,
}: {
  items: readonly { title: string; body: string }[];
}) {
  return (
    <ul className="mt-8 grid min-w-0 gap-4 md:grid-cols-3">
      {items.map((item) => (
        <li key={item.title} className="min-w-0 rounded-lg border bg-card p-5">
          <h3 className="text-base font-semibold">{item.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

export async function MarketingHome() {
  const price = formatPlanPriceUsd();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": bizlyroEntityGraph(HOME_METADATA.description, {
      price: String(BIZPILOT_PRO.amountCents / 100),
      priceCurrency: BIZPILOT_PRO.currency.toUpperCase(),
      url: `${BIZLYRO_PUBLIC_ORIGIN}/signup`,
    }),
  };

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden">
      <a
        href="#hero"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SiteHeader landing />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-w-0">
        <section id="hero" className={`${sectionClass} relative overflow-hidden border-b`}>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_8%_0%,oklch(0.92_0.045_264),transparent_52%),linear-gradient(180deg,oklch(0.975_0.01_264),oklch(0.965_0.008_264))]"
          />
          <div className={`${wrapClass} relative py-14 sm:py-16 lg:py-20`}>
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="min-w-0">
                <p className="inline-flex max-w-full items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium tracking-wide text-primary uppercase">
                  {LANDING_HERO.eyebrow}
                </p>
                <h1 className="font-heading mt-4 max-w-3xl text-balance text-3xl leading-[1.12] tracking-tight sm:text-4xl lg:text-5xl">
                  {LANDING_HERO.title}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {LANDING_HERO.subtitle}
                </p>
                <HonestAiNote className="mt-5 max-w-2xl" />
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground">
                  {LANDING_HERO.entity}
                </p>
                <CtaPair className="mt-7" />
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-foreground">
                  {LANDING_HERO.ctaSupport}
                </p>
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  {LANDING_HERO.demoNote}
                </p>
              </div>
              <Card className="min-w-0 border-primary/15 shadow-[0_24px_60px_-32px_oklch(0.32_0.1_264/0.55)]">
                <CardHeader className="border-b">
                  <p className="text-xs font-medium tracking-wide text-primary uppercase">{PUBLIC_PRODUCT_NAME}</p>
                  <p className="font-heading text-4xl tracking-tight">
                    {price}
                    <span className="text-base font-sans font-medium text-muted-foreground"> USD / month</span>
                  </p>
                  <CardDescription>One business workspace. Cancel anytime. No overage invoice.</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="grid gap-2">
                    {PRICING_FEATURES.slice(0, 6).map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Built for one business at a time. {BIZPILOT_PRO.replyLimit} AI replies each month.
                    You stay in control of email, quotes, and anything that needs a person.
                  </p>
                  <Button
                    className="mt-5 w-full"
                    nativeButton={false}
                    render={<Link href={LANDING_PRIMARY_CTA.href} />}
                  >
                    {LANDING_PRIMARY_CTA.label}
                    <ArrowRight aria-hidden />
                  </Button>
                </CardContent>
              </Card>
            </div>
            <ul className="mt-10 grid min-w-0 gap-3 sm:grid-cols-3">
              {HERO_OUTCOMES.map((item, index) => {
                const Icon = OUTCOME_ICONS[index] ?? MessageSquare;
                return (
                  <li key={item.title} className="min-w-0 rounded-xl border bg-card/90 p-4 shadow-[0_1px_2px_oklch(0.22_0.03_264/0.04)]">
                    <Icon className="size-4 text-primary" aria-hidden />
                    <p className="mt-3 text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section id="problem" className={`${sectionClass} py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">The gap</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              Your site still gets questions when you are not at the desk.
            </h2>
            <PointGrid items={PROBLEM_POINTS} />
          </div>
        </section>

        <section id="solution" className={`${sectionClass} border-y bg-card/60 py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">The product</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              Train it on your business. Let it help visitors. Review what it cannot answer.
            </h2>
            <PointGrid items={SOLUTION_POINTS} />
            <ul className="mt-8 grid min-w-0 gap-2 text-sm text-muted-foreground">
              {WHO_IT_FITS.map((line) => (
                <li key={line} className="flex min-w-0 items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <h3 className="font-heading mt-10 text-xl tracking-tight">Guides</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Longer notes on the jobs Bizlyro is built to do, including the limits of each one.
            </p>
            <ul className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
              {SEO_ROUTES.map((route) => (
                <li key={route.path} className="min-w-0 rounded-lg border bg-card p-5">
                  <Link className="font-medium underline-offset-2 hover:underline" href={route.path}>
                    {route.label}
                  </Link>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{route.blurb}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="product" className={`${sectionClass} py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Product</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              The desk your visitors never see, and the widget they do.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              This preview uses the real Inbox, Leads, and chat layout. Names and messages are
              sample copy so the page never pretends to show live customers.
            </p>
            <SectionGuide sectionId="product" />
            <div className="mt-8">
              <ProductPreview />
            </div>
          </div>
        </section>

        {CAPABILITY_SECTIONS.map((item) => (
          <section
            key={item.id}
            id={item.id}
            className={`${sectionClass} border-t py-14 sm:py-16 ${item.id === "sales-assistant" ? "bg-card/60" : ""}`}
          >
            <div className={`${wrapClass} max-w-3xl`}>
              <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">{item.title}</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">{item.body}</p>
              <SectionGuide sectionId={item.id} />
            </div>
          </section>
        ))}

        <section id="knowledge" className={`${sectionClass} border-t bg-card/60 py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Knowledge</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              The knowledge engine is the source of every safe answer.
            </h2>
            <PointGrid items={KNOWLEDGE_POINTS} />
          </div>
        </section>

        <section id="inbox" className={`${sectionClass} py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Inbox</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              A professional inbox for website chat, Gmail, and drafts.
            </h2>
            <PointGrid items={INBOX_POINTS} />
          </div>
        </section>

        <section id="handoff" className={`${sectionClass} border-y bg-card/60 py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Handoff</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              AI pauses. You take the thread. Nothing is sent on your behalf.
            </h2>
            <PointGrid items={HANDOFF_POINTS} />
          </div>
        </section>

        <section id="how-it-works" className={`${sectionClass} py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">How it works</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              Account, then {PUBLIC_PRODUCT_NAME}, then knowledge, then the widget.
            </h2>
            <ol className="mt-8 grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS_STEPS.map((item) => (
                <li key={item.step} className="min-w-0 rounded-lg border bg-card p-5">
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                    Step {item.step}
                  </p>
                  <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-muted-foreground">
              Want the layout without paying yet?{" "}
              <Link className="font-medium text-foreground underline-offset-2 hover:underline" href={LANDING_DEMO.href}>
                {LANDING_DEMO.label}
              </Link>
              . It stays in this browser.
            </p>
          </div>
        </section>

        <section id="widget" className={`${sectionClass} border-t bg-card/60 py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Widget</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              One website widget. The customer never logs in.
            </h2>
            <SectionGuide sectionId="widget" />
            <PointGrid items={WIDGET_POINTS} />
          </div>
        </section>

        <section id="integrations" className={`${sectionClass} py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Integrations</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              Gmail is live to connect. Store and calendar apps are not.
            </h2>
            <ul className="mt-8 grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {INTEGRATION_ITEMS.map((item) => (
                <li key={item.name} className="min-w-0 rounded-lg border bg-card p-5">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{item.name}</h3>
                    <span
                      className={
                        item.live
                          ? "rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                          : "rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="analytics" className={`${sectionClass} border-y bg-card/60 py-14 sm:py-16`}>
          <div className={wrapClass}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Analytics</p>
            <h2 className="font-heading mt-2 max-w-2xl text-2xl tracking-tight sm:text-3xl">
              Numbers come from stored data, not a marketing estimate.
            </h2>
            <PointGrid items={ANALYTICS_POINTS} />
          </div>
        </section>

        <section id="pricing" className={`${sectionClass} py-14 sm:py-16`}>
          <div className={`${wrapClass} grid min-w-0 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]`}>
            <div className="min-w-0">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pricing</p>
              <h2 className="font-heading mt-2 text-2xl tracking-tight sm:text-3xl">
                One plan. {price} per month.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
                {PUBLIC_PRODUCT_NAME} is billed monthly in USD through Stripe. Create an account,
                then subscribe. When the {BIZPILOT_PRO.replyLimit}-reply allowance is used, AI
                stops. There is no overage invoice.
              </p>
            </div>
            <Card className="min-w-0">
              <CardHeader className="border-b">
                <CardTitle className="text-lg">{PUBLIC_PRODUCT_NAME}</CardTitle>
                <CardDescription>Per business, billed monthly in USD.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="font-heading text-4xl tracking-tight">
                  {price}
                  <span className="text-base font-sans text-muted-foreground"> USD / month</span>
                </p>
                <HonestAiNote className="mt-4" />
                <ul className="mt-4 grid gap-2">
                  {PRICING_FEATURES.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-5 w-full min-w-0 sm:w-auto" nativeButton={false} render={<Link href={LANDING_PRIMARY_CTA.href} />}>
                  {LANDING_PRIMARY_CTA.label}
                  <ArrowRight aria-hidden />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="faq" className={`${sectionClass} border-t bg-card/60 py-14 sm:py-16`}>
          <div className={`${wrapClass} max-w-3xl`}>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">FAQ</p>
            <h2 className="font-heading mt-2 text-2xl tracking-tight sm:text-3xl">
              Straight answers before you subscribe.
            </h2>
            <div className="mt-8">
              <MarketingFaq />
            </div>
          </div>
        </section>

        <section id="final-cta" className={`${sectionClass} bg-[oklch(0.22_0.035_264)] py-14 text-[oklch(0.97_0.006_264)] sm:py-16`}>
          <div className={wrapClass}>
            <h2 className="font-heading max-w-2xl text-2xl tracking-tight sm:text-3xl">
              Answer customers and capture leads — without a front desk.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75">
              Get started creates the account. Stripe collects {price} USD per month for {PUBLIC_PRODUCT_NAME}.
              Cancel anytime. The demo remains a local preview if you want to see the layout first.
            </p>
            <div className="mt-7 flex min-w-0 flex-wrap gap-3">
              <Button size="lg" className="px-4 sm:px-5" nativeButton={false} render={<Link href={LANDING_PRIMARY_CTA.href} />}>
                {LANDING_PRIMARY_CTA.label}
                <ArrowRight aria-hidden />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                nativeButton={false}
                render={<Link href={LANDING_DEMO.href} />}
              >
                {LANDING_DEMO.label}
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
