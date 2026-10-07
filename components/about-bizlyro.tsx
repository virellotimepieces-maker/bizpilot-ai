import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  ABOUT_ENTITY,
  ABOUT_FOR,
  ABOUT_HONEST,
  ABOUT_PAGE,
  ABOUT_PRICE_LABEL,
  ABOUT_PRIMARY_CTA,
  ABOUT_REPLY_LIMIT,
  ABOUT_WHY,
  aboutPageJsonLd,
} from "@/lib/marketing/about-page";
import Link from "next/link";

const wrapClass = "mx-auto w-full min-w-0 max-w-3xl px-4 sm:px-6";

export function AboutBizlyro() {
  const jsonLd = JSON.stringify(aboutPageJsonLd()).replace(/</g, "\\u003c");

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="min-w-0">
        <section className="border-b bg-[linear-gradient(180deg,oklch(0.97_0.012_264),oklch(0.975_0.006_264))]">
          <div className={`${wrapClass} py-12 sm:py-16`}>
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">{ABOUT_PAGE.eyebrow}</p>
            <h1 className="font-heading mt-3 text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {ABOUT_PAGE.h1}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{ABOUT_PAGE.lede}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{ABOUT_ENTITY}</p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              The widget answers published customer questions 24/7. When someone wants a person, it
              can store the lead. {ABOUT_HONEST}
            </p>
            <div className="mt-7 flex min-w-0 flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href={ABOUT_PRIMARY_CTA.href} />}>
                {ABOUT_PRIMARY_CTA.label}
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href="/product" />}>
                Product overview
              </Button>
            </div>
          </div>
        </section>

        <section className="border-b py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">What Bizlyro does</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              A customer opens your site and asks a question in the widget. If you published the
              answer — hours, a service area, a price you are willing to repeat — Bizlyro can give
              that answer. If they leave a name and email, or ask for a quote or a callback, that
              request stays in your workspace until you review it.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              It is one business and one website widget. It is not a call center, and it is not a
              claim that a teammate is working overnight. You still decide what gets sent.
            </p>
          </div>
        </section>

        <section className="border-b bg-card/60 py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Who it is for</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Bizlyro is for an owner-operated business with a website and a person who will read
              the leads. It fits when the same questions repeat and the safe answer is already
              written down.
            </p>
            <ul className="mt-8 grid gap-4">
              {ABOUT_FOR.map((item) => (
                <li key={item.title} className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="why-bizlyro" className="border-b py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Why Bizlyro</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              The useful part is narrow: answer from your knowledge, keep the lead, and leave the
              unknown facts to you.
            </p>
            <ul className="mt-8 grid gap-4">
              {ABOUT_WHY.map((item) => (
                <li key={item.title} className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b bg-card/60 py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Install it on your site</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Get started creates an account. You then subscribe. The paid workspace gives you one
              snippet to place on the site you already run. Publish the hours, services, and prices
              you want repeated. Visitors chat there. You work from Inbox and Leads.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Bizlyro AI is {ABOUT_PRICE_LABEL} per month. One business. One installed widget.{" "}
              {ABOUT_REPLY_LIMIT} AI-generated customer replies each billing month. Cancel anytime.
              No automatic overage charges.
            </p>
            <div className="mt-7">
              <Button size="lg" nativeButton={false} render={<Link href={ABOUT_PRIMARY_CTA.href} />}>
                {ABOUT_PRIMARY_CTA.label}
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
