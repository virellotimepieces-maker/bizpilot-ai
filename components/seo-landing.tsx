import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { LANDING_DEMO, LANDING_PRIMARY_CTA, PUBLIC_PRODUCT_NAME, formatPlanPriceUsd } from "@/lib/marketing/copy";
import { seoPageJsonLd, type SeoLandingPage } from "@/lib/marketing/seo-pages";
import Link from "next/link";

const wrapClass = "mx-auto w-full min-w-0 max-w-3xl px-4 sm:px-6";

export function SeoLanding({ page }: { page: SeoLandingPage }) {
  const jsonLd = JSON.stringify(seoPageJsonLd(page)).replace(/</g, "\\u003c");

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="min-w-0">
        <section className="border-b bg-[linear-gradient(180deg,oklch(0.97_0.012_264),oklch(0.975_0.006_264))]">
          <div className={`${wrapClass} py-12 sm:py-16`}>
            <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <Link className="hover:underline" href="/">
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-foreground">
                  {page.label}
                </li>
              </ol>
            </nav>
            <p className="mt-6 text-xs font-medium tracking-[0.18em] text-primary uppercase">
              {page.eyebrow}
            </p>
            <h1 className="font-heading mt-3 text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {page.h1}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{page.lede}</p>
            <div className="mt-7 flex min-w-0 flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href={LANDING_PRIMARY_CTA.href} />}>
                {LANDING_PRIMARY_CTA.label}
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href={LANDING_DEMO.href} />}>
                {LANDING_DEMO.label}
              </Button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Get started creates an account, then {PUBLIC_PRODUCT_NAME} is {formatPlanPriceUsd()} per
              month. The demo is a browser-only preview. It does not call an AI model or Stripe.
            </p>
          </div>
        </section>

        {page.sections.map((section) => (
          <section key={section.heading} className="border-b py-14 sm:py-16">
            <div className={wrapClass}>
              <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.links && section.links.length > 0 ? (
                <ul className="mt-4 grid gap-2 text-sm">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link className="font-medium text-foreground underline-offset-2 hover:underline" href={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}

        <section className="border-b bg-card/60 py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">How this helps</h2>
            <ul className="mt-8 grid gap-4">
              {page.benefits.map((item) => (
                <li key={item.title} className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">What Bizlyro will not do</h2>
            <ul className="mt-8 grid gap-4">
              {page.limits.map((item) => (
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
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">How to start</h2>
            <ol className="mt-8 grid gap-4">
              {page.steps.map((item, index) => (
                <li key={item.title} className="rounded-lg border bg-card p-5">
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Questions</h2>
            <div className="mt-8 grid gap-6">
              {page.faqs.map((faq) => (
                <article key={faq.question}>
                  <h3 className="text-base font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b bg-card/60 py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Related Bizlyro pages</h2>
            <ul className="mt-6 grid gap-2 text-sm">
              <li>
                <Link className="font-medium text-foreground underline-offset-2 hover:underline" href="/">
                  Bizlyro homepage
                </Link>
              </li>
              {page.related.map((link) => (
                <li key={link.href}>
                  <Link className="font-medium text-foreground underline-offset-2 hover:underline" href={link.href}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-[oklch(0.22_0.035_264)] py-14 text-[oklch(0.97_0.006_264)] sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">
              Put Bizlyro on your site
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-white/75">
              Create an account, subscribe to {PUBLIC_PRODUCT_NAME}, and publish the facts this page
              describes. The local demo stays a preview if you want to see the layout first.
            </p>
            <div className="mt-7 flex min-w-0 flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href={LANDING_PRIMARY_CTA.href} />}>
                {LANDING_PRIMARY_CTA.label}
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
