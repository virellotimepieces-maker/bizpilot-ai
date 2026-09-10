"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/app/inbox", label: "Inbox", icon: MessageSquare },
  { href: "/app/widget", label: "Website widget", icon: Puzzle },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/account", label: "Account", icon: UserRound },
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
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm",
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3 md:hidden">
          <span className="font-heading">BizPilot Pro</span>
          <Button size="sm" variant="outline" render={<Link href="/billing" />}>
            Billing
          </Button>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
