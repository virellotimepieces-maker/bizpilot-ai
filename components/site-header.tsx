import { Button } from "@/components/ui/button";
import { DeskMark } from "@/components/desk-mark";
import { StoreLiveHeaderBadge, StoreLivePublicStrip } from "@/components/store-live-status";
import {
  LANDING_NAV,
  LANDING_PRIMARY_CTA,
  LANDING_SIGN_IN,
  LANDING_DEMO,
} from "@/lib/marketing/copy";
import Link from "next/link";

export function SiteHeader({
  signedIn = false,
  landing = false,
}: {
  signedIn?: boolean;
  landing?: boolean;
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <DeskMark href="/" />
          <StoreLiveHeaderBadge />
        </div>
        <nav className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-2" aria-label="Site">
          {landing
            ? LANDING_NAV.map((item) => (
                <Button
                  key={item.href}
                  variant="ghost"
                  size="sm"
                  className="hidden md:inline-flex"
                  nativeButton={false}
                  render={<a href={item.href} />}
                >
                  {item.label}
                </Button>
              ))
            : (
                <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={LANDING_DEMO.href} />}>
                  Demo
                </Button>
              )}
          {signedIn ? (
            <>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/app" />}>
                Dashboard
              </Button>
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/billing" />}>
                Billing
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href={LANDING_SIGN_IN.href} />}>
                {LANDING_SIGN_IN.label}
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href={LANDING_PRIMARY_CTA.href} />}>
                {LANDING_PRIMARY_CTA.label}
              </Button>
            </>
          )}
        </nav>
      </div>
      <StoreLivePublicStrip />
    </header>
  );
}
