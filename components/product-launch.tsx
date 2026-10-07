import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import {
  PRODUCT_AUDIENCES,
  PRODUCT_CAPABILITIES,
  PRODUCT_ENTITY,
  PRODUCT_FAQS,
  PRODUCT_HONEST,
  PRODUCT_LIMITS,
  PRODUCT_PAGE,
  PRODUCT_PRICE_LABEL,
  PRODUCT_PRIMARY_CTA,
  PRODUCT_SETUP_STEPS,
  productPageJsonLd,
} from "@/lib/marketing/product-page";
import { BIZPILOT_PRO } from "@/lib/plan";
import Link from "next/link";

const wrapClass = "mx-auto w-full min-w-0 max-w-3xl px-4 sm:px-6";

export function ProductLaunch() {
  const jsonLd = JSON.stringify(productPageJsonLd()).replace(/</g, "\\u003c");

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden">
      <SiteHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <main className="min-w-0">
        <section className="border-b bg-[linear-gradient(180deg,oklch(0.97_0.012_264),oklch(0.975_0.006_264))]">
          <div className={`${wrapClass} py-12 sm:py-16`}>
            <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">{PRODUCT_PAGE.eyebrow}</p>
            <h1 className="font-heading mt-3 text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              {PRODUCT_PAGE.h1}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">{PRODUCT_PAGE.lede}</p>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{PRODUCT_ENTITY}</p>
            <div className="mt-7 flex min-w-0 flex-wrap gap-3">
              <Button size="lg" nativeButton={false} render={<Link href={PRODUCT_PRIMARY_CTA.href} />}>
                {PRODUCT_PRIMARY_CTA.label}
              </Button>
              <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#demos" />}>
                View sample demos
              </Button>
            </div>
            <p className="mt-4 rounded-lg border bg-card px-4 py-3 text-sm leading-relaxed">
              {PRODUCT_HONEST}
            </p>
          </div>
        </section>

        <section className="border-b py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">What Bizlyro is</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Bizlyro AI sits on a website you already own. A visitor asks a question in the widget.
              If the answer is in the knowledge you published, the widget can give that answer. If the
              visitor wants to be contacted, the name, email, and request stay in your workspace. You
              decide what to send back.
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              It is one workspace and one widget. It is not a store plugin, a call center, or a promise
              that a teammate is awake at 2 a.m. The work it can do is the work you wrote down: hours,
              services, published prices, policies, and the handoff when a person should take over.
            </p>
          </div>
        </section>

        <section className="border-b bg-card/60 py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Who it is for</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Bizlyro is for an owner-operated business with a website and someone who will read the
              leads. Contractors, dental clinics, and other local services are the clearest fits,
              because the same questions repeat while the owner is with a customer. A business that
              wants the assistant to invent a quote, confirm an unopened time, or give clinical advice
              is not a fit.
            </p>
            <ul className="mt-8 grid gap-4">
              {PRODUCT_AUDIENCES.map((item) => (
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
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">What the product does</h2>
            <ul className="mt-8 grid gap-4">
              {PRODUCT_CAPABILITIES.map((item) => (
                <li key={item.title} className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="demos" className="border-b bg-card/60 py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Sample industry demos</h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Each demo is sample data in this browser. It shows a visitor question, an answer from
              published sample facts, a refusal when a price or promotion was not published, and the
              lead the owner would review. It does not call Stripe and it is not a live customer.
            </p>
            <ul className="mt-8 grid gap-4">
              {PRODUCT_AUDIENCES.map((item) => (
                <li key={item.demoHref} className="rounded-lg border bg-card p-5">
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <div className="mt-3 flex min-w-0 flex-wrap gap-3 text-sm">
                    <Link className="font-medium underline-offset-2 hover:underline" href={item.demoHref}>
                      Open the sample demo
                    </Link>
                    <Link className="font-medium underline-offset-2 hover:underline" href={item.href}>
                      Read the industry page
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Install the widget</h2>
            <ol className="mt-8 grid gap-4">
              {PRODUCT_SETUP_STEPS.map((step) => (
                <li key={step.step} className="rounded-lg border bg-card p-5">
                  <p className="text-xs font-semibold tracking-wide text-primary uppercase">Step {step.step}</p>
                  <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b bg-card/60 py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">
              {PRODUCT_PRICE_LABEL} per month
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              One business. One installed widget. {BIZPILOT_PRO.replyLimit} AI-generated customer
              replies each billing month. Cancel anytime. No automatic overage charges. Get started
              creates the account, then you subscribe.
            </p>
            <div className="mt-7">
              <Button size="lg" nativeButton={false} render={<Link href={PRODUCT_PRIMARY_CTA.href} />}>
                {PRODUCT_PRIMARY_CTA.label}
              </Button>
            </div>
          </div>
        </section>

        <section className="border-b py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">What this page does not claim</h2>
            <ul className="mt-6 grid gap-3 text-sm leading-relaxed text-muted-foreground">
              {PRODUCT_LIMITS.map((item) => (
                <li key={item} className="rounded-lg border bg-card p-4">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b bg-card/60 py-14 sm:py-16">
          <div className={wrapClass}>
            <h2 className="font-heading text-2xl tracking-tight sm:text-3xl">Questions before you start</h2>
            <div className="mt-8 grid gap-6">
              {PRODUCT_FAQS.map((faq) => (
                <article key={faq.question}>
                  <h3 className="text-base font-semibold">{faq.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
