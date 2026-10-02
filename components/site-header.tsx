import { Button } from "@/components/ui/button";
import { DeskMark } from "@/components/desk-mark";
import { StoreLiveHeaderBadge, StoreLivePublicStrip } from "@/components/store-live-status";
import Link from "next/link";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <DeskMark href="/" />
          <StoreLiveHeaderBadge />
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link href="/demo" />}>
            Demo
          </Button>
          {signedIn ? (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/app" />}>
                Dashboard
              </Button>
              <Button variant="outline" size="sm" render={<Link href="/billing" />}>
                Billing
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>
                Sign in
              </Button>
              <Button size="sm" render={<Link href="/signup" />}>
                Subscribe
              </Button>
            </>
          )}
        </nav>
      </div>
      <StoreLivePublicStrip />
    </header>
  );
}
