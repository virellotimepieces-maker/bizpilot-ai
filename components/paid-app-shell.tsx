"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TAB_ITEM_CLASS, TAB_ROW_CLASS, TOUCH_TARGET_CLASS } from "@/lib/ui/type-scale";
import {
  BookOpen,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Puzzle,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/app", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { href: "/app/knowledge", label: "Knowledge", short: "Knowledge", icon: BookOpen },
  { href: "/app/inbox", label: "Inbox", short: "Inbox", icon: MessageSquare },
  { href: "/app/widget", label: "Website widget", short: "Widget", icon: Puzzle },
  { href: "/billing", label: "Billing", short: "Billing", icon: CreditCard },
  { href: "/account", label: "Account", short: "Account", icon: UserRound },
];

export function PaidAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-full bg-background">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-sidebar p-4 text-sidebar-foreground md:flex md:flex-col">
        <p className="font-heading px-1 text-lg text-white">BizPilot Pro</p>
        <nav className="mt-6 grid gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-base",
                  active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-1 text-[11px] leading-relaxed text-white/40">
          Paid workspace. Demo mode lives at /demo and does not share this data.
        </p>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="flex items-center justify-between gap-3 border-b px-3 py-2 md:hidden">
          <span className="font-heading text-2xl leading-none">BizPilot Pro</span>
          <Button size="sm" variant="outline" className={TOUCH_TARGET_CLASS} render={<Link href="/billing" />}>
            Billing
          </Button>
        </header>
        <nav className={`${TAB_ROW_CLASS} border-b px-3 py-2 md:hidden`} aria-label="Workspace">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  TAB_ITEM_CLASS,
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground ring-1 ring-foreground/10",
                )}
              >
                {item.short}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
