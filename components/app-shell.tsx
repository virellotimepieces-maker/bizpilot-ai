"use client";

import { DeskMark } from "@/components/desk-mark";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BUSINESS_TYPE_LABEL } from "@/lib/labels";
import { useWorkspace } from "@/lib/workspace-store";
import { cn } from "@/lib/utils";
import { TOUCH_TARGET_CLASS } from "@/lib/ui/type-scale";
import {
  BookOpen,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/knowledge", label: "Knowledge base", icon: BookOpen },
  { href: "/chat", label: "Website chat", icon: MessageSquare },
  { href: "/inbox", label: "Email drafts", icon: Inbox },
  { href: "/social", label: "Social drafts", icon: Share2 },
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
    <nav className="grid gap-0.5">
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
              "flex min-h-11 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function WorkspaceMeta() {
  const { knowledge } = useWorkspace();
  if (!knowledge) {
    return (
      <p className="px-2 text-xs leading-relaxed text-muted-foreground">
        Load a business to share one knowledge base across chat, email, and social.
      </p>
    );
  }
  return (
    <div className="rounded-md border bg-card px-3 py-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {BUSINESS_TYPE_LABEL[knowledge.businessType]}
      </p>
      <p className="mt-1 text-sm leading-snug font-medium">{knowledge.name || "Untitled business"}</p>
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
    <div className="flex h-full flex-col gap-5 p-3">
      <DeskMark href={demo ? "/demo" : "/"} subtitle={demo ? "Demo desk" : "Support desk"} />
      <NavLinks onNavigate={onNavigate} basePath={basePath} />
      <div className="mt-auto grid gap-3">
        {demo ? (
          <div className="rounded-md border border-amber-700/20 bg-amber-50 px-3 py-3 text-xs leading-relaxed text-foreground">
            Demo mode. This is not a paid workspace. It stays in this browser and does not bill or
            call an AI model.
          </div>
        ) : (
          <WorkspaceMeta />
        )}
        {demo ? (
          <Link href="/" className="px-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline">
            Back to BizPilot AI
          </Link>
        ) : (
          <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
            Website chat may answer published facts. Email and social drafts always wait for a human.
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
  const pathname = usePathname();

  return (
    <div className="flex min-h-full bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
        <SidebarBody basePath={basePath} demo={demo} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="flex items-center gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur md:hidden">
          <Button variant="outline" size="icon" className={TOUCH_TARGET_CLASS} onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
          <DeskMark href={demo ? "/demo" : "/"} className="min-w-0 flex-1" />
        </header>
        <nav className="flex min-w-0 gap-2 overflow-x-auto border-b px-3 py-2 overscroll-x-contain md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Desk">
          {NAV.map((item) => {
            const href = `${basePath}${item.href === "/" ? "" : item.href}` || "/";
            const compact =
              item.href === "/knowledge"
                ? "Knowledge"
                : item.href === "/chat"
                  ? "Chat"
                  : item.href === "/inbox"
                    ? "Email"
                    : item.href === "/social"
                      ? "Social"
                      : "Overview";
            return (
              <Link
                key={item.href}
                href={href}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center min-h-11 rounded-md px-3 text-sm font-medium whitespace-nowrap",
                  pathname === href || (item.href === "/" && pathname === basePath)
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground ring-1 ring-border",
                )}
              >
                {compact}
              </Link>
            );
          })}
        </nav>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-[min(18rem,100%)] bg-sidebar p-0 text-sidebar-foreground">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <SidebarBody basePath={basePath} demo={demo} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
