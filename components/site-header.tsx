import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="font-heading text-lg">BizPilot AI</span>
        </Link>
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
    </header>
  );
}
