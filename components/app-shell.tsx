"use client";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BUSINESS_TYPE_LABEL } from "@/lib/labels";
import { useWorkspace } from "@/lib/workspace-store";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/knowledge", label: "Knowledge base", icon: BookOpen },
  { href: "/chat", label: "Website chat", icon: MessageSquare },
  { href: "/inbox", label: "Email drafts", icon: Inbox },
] as const;

function NavLinks({
  onNavigate,
  basePath,
}: {
  onNavigate?: () => void;
  basePath: string;
}) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {NAV.map((item) => {
        const href = `${basePath}${item.href === "/" ? "" : item.href}` || "/";
        const active = pathname === href || (item.href === "/" && pathname === basePath);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition",
              active
                ? "bg-white/12 text-white shadow-sm"
                : "text-white/70 hover:bg-white/8 hover:text-white",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand({ homeHref }: { homeHref: string }) {
  return (
    <Link href={homeHref} className="flex items-center gap-2.5 px-1 py-1">
      <span className="flex size-9 items-center justify-center rounded-xl bg-[oklch(0.78_0.12_85)] text-[oklch(0.22_0.04_165)]">
        <Sparkles className="size-4" />
      </span>
      <span>
        <span className="block font-heading text-base leading-none text-white">BizPilot AI</span>
        <span className="mt-1 block text-[11px] tracking-[0.18em] text-white/55 uppercase">
          Support desk
        </span>
      </span>
    </Link>
  );
}

function WorkspaceMeta() {
  const { knowledge } = useWorkspace();
  if (!knowledge) {
    return (
      <p className="px-3 text-xs leading-relaxed text-white/55">
        Load a business to share one knowledge base across chat and email.
      </p>
    );
  }
  return (
    <div className="rounded-xl bg-white/8 px-3 py-3">
      <p className="text-[11px] tracking-wide text-white/50 uppercase">
        {BUSINESS_TYPE_LABEL[knowledge.businessType]}
      </p>
      <p className="mt-1 text-sm leading-snug text-white">{knowledge.name || "Untitled business"}</p>
    </div>
  );
}

function SidebarBody({
  onNavigate,
  basePath,
  demo,
}: {
  onNavigate?: () => void;
  basePath: string;
  demo: boolean;
}) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand homeHref={demo ? "/demo" : "/"} />
      <NavLinks onNavigate={onNavigate} basePath={basePath} />
      <div className="mt-auto grid gap-3">
        {demo ? (
          <div className="rounded-xl bg-amber-400/15 px-3 py-3 text-xs leading-relaxed text-amber-50">
            Demo mode. This is not a paid workspace. It stays in this browser and does not bill or
            call an AI model.
          </div>
        ) : (
          <WorkspaceMeta />
        )}
        {demo ? (
          <Link href="/" className="px-1 text-[11px] text-white/55 underline-offset-2 hover:underline">
            Back to BizPilot Pro
          </Link>
        ) : (
          <p className="px-1 text-[11px] leading-relaxed text-white/40">
            Website chat may answer published facts. Email always waits for a human to approve the
            draft.
          </p>
        )}
      </div>
    </div>
  );
}

export function AppShell({
  children,
  basePath = "",
  demo = false,
}: {
  children: React.ReactNode;
  basePath?: string;
  demo?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <SidebarBody basePath={basePath} demo={demo} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <Button variant="outline" size="icon-sm" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
          <span className="font-heading">BizPilot AI</span>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <SidebarBody basePath={basePath} demo={demo} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
