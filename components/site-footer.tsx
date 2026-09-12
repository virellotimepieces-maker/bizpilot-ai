import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6">
        <p>BizPilot AI — one business, one widget, drafts you send yourself.</p>
        <nav className="flex flex-wrap gap-4">
          <Link className="underline-offset-2 hover:underline" href="/privacy">
            Privacy
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/terms">
            Terms
          </Link>
          <Link className="underline-offset-2 hover:underline" href="/demo">
            Demo
          </Link>
        </nav>
      </div>
    </footer>
  );
}
