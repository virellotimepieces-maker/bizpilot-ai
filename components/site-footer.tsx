import Link from "next/link";
import { DeskMark } from "@/components/desk-mark";
import { PUBLIC_MARK, PUBLIC_PRODUCT_NAME } from "@/lib/marketing/copy";
import { LANDING_DEMO, LANDING_NAV, LANDING_PRIMARY_CTA, LANDING_SIGN_IN } from "@/lib/marketing/copy";
import { INTENT_ROUTES, SEO_ROUTES } from "@/lib/marketing/seo-routes";

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto grid w-full min-w-0 max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="min-w-0">
          <DeskMark href="/" name={PUBLIC_PRODUCT_NAME} mark={PUBLIC_MARK} />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            24/7 AI customer service and sales assistance for one business. Answers from your
            knowledge. Drafts you send yourself.
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Product</p>
          <nav className="mt-3 grid gap-2 text-sm">
            {LANDING_NAV.map((item) => (
              <a key={item.href} className="hover:underline" href={`/${item.href}`}>
                {item.label}
              </a>
            ))}
            <Link className="hover:underline" href={LANDING_DEMO.href}>
              Demo
            </Link>
            <Link className="hover:underline" href="/product">
              Product overview
            </Link>
            <Link className="hover:underline" href="/about">
              About
            </Link>
            {SEO_ROUTES.map((route) => (
              <Link key={route.path} className="hover:underline" href={route.path}>
                {route.label}
              </Link>
            ))}
            {INTENT_ROUTES.map((route) => (
              <Link key={route.path} className="hover:underline" href={route.path}>
                {route.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Account</p>
          <nav className="mt-3 grid gap-2 text-sm">
            <Link className="hover:underline" href={LANDING_PRIMARY_CTA.href}>
              {LANDING_PRIMARY_CTA.label}
            </Link>
            <Link className="hover:underline" href={LANDING_SIGN_IN.href}>
              {LANDING_SIGN_IN.label}
            </Link>
          </nav>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Legal</p>
          <nav className="mt-3 grid gap-2 text-sm">
            <Link className="hover:underline" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:underline" href="/terms">
              Terms
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
