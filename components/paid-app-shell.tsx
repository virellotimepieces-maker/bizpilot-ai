"use client";

import { DeskMark } from "@/components/desk-mark";
import { StoreLiveHeaderBadge } from "@/components/store-live-status";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DESK_MOBILE_PRIMARY,
  DESK_NAV,
  deskNavById,
  deskPageTitle,
  isDeskNavActive,
} from "@/lib/ui/desk-nav";
import { TOUCH_TARGET_CLASS } from "@/lib/ui/type-scale";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

function NavList({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="grid gap-0.5" aria-label="Workspace">
      {DESK_NAV.map((item) => {
        const Icon = item.icon;
        const active = isDeskNavActive(pathname, item);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 min-w-0 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function PaidAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const title = deskPageTitle(pathname);

  return (
    <div className="flex min-h-full min-w-0 bg-background">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex">
        <div className="flex items-start justify-between gap-2 px-1">
          <DeskMark subtitle="Workspace" />
        </div>
        <div className="mt-5 min-w-0 flex-1 overflow-y-auto">
          <NavList pathname={pathname} />
        </div>
        <div className="mt-3 min-w-0 px-1">
          <StoreLiveHeaderBadge />
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Paid workspace. Demo data at /demo is separate and is not billed.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-3 py-2 backdrop-blur lg:hidden">
          <Button
            variant="outline"
            size="icon"
            className={TOUCH_TARGET_CLASS}
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-4" />
          </Button>
          <DeskMark className="min-w-0 flex-1" />
          <span className="sr-only">{title}</span>
        </header>

        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-[min(18rem,100%)] bg-sidebar p-3">
            <SheetHeader className="px-1 text-left">
              <SheetTitle className="text-sm font-semibold">Workspace</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <NavList pathname={pathname} onNavigate={() => setMenuOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] sm:px-5 lg:px-8 lg:pb-6">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 px-1 pt-1 backdrop-blur lg:hidden"
          style={{ paddingBottom: "max(0.4rem, env(safe-area-inset-bottom))" }}
          aria-label="Primary"
        >
          {DESK_MOBILE_PRIMARY.map((id) => {
            const item = deskNavById(id);
            const Icon = item.icon;
            const active = isDeskNavActive(pathname, item);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={cn(
                  "flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-medium leading-tight",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="max-w-full truncate">{item.short}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className="flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[10px] font-medium leading-tight text-muted-foreground"
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="size-4 shrink-0" aria-hidden />
            <span>More</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
