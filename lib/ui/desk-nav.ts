import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  Inbox,
  LayoutDashboard,
  Puzzle,
  Settings,
  UserRoundPlus,
  Workflow,
} from "lucide-react";

export type DeskNavId =
  | "overview"
  | "inbox"
  | "leads"
  | "knowledge"
  | "analytics"
  | "integrations"
  | "widget"
  | "settings"
  | "billing";

export interface DeskNavItem {
  id: DeskNavId;
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  aliases?: readonly string[];
}

export const DESK_NAV: readonly DeskNavItem[] = [
  { id: "overview", href: "/app", label: "Overview", short: "Overview", icon: LayoutDashboard },
  { id: "inbox", href: "/app/inbox", label: "Inbox", short: "Inbox", icon: Inbox },
  { id: "leads", href: "/app/leads", label: "Leads", short: "Leads", icon: UserRoundPlus, aliases: ["/app/quotes", "/app/appointments"] },
  { id: "knowledge", href: "/app/knowledge", label: "Knowledge", short: "Knowledge", icon: BookOpen },
  { id: "analytics", href: "/app/analytics", label: "Analytics", short: "Analytics", icon: BarChart3 },
  {
    id: "integrations",
    href: "/app/integrations",
    label: "Integrations",
    short: "Connect",
    icon: Workflow,
    aliases: ["/app/email", "/app/social"],
  },
  { id: "widget", href: "/app/widget", label: "Widget", short: "Widget", icon: Puzzle },
  {
    id: "settings",
    href: "/app/settings",
    label: "Settings",
    short: "Settings",
    icon: Settings,
    aliases: ["/account"],
  },
  {
    id: "billing",
    href: "/app/billing",
    label: "Billing",
    short: "Billing",
    icon: CreditCard,
    aliases: ["/billing"],
  },
] as const;

export const DESK_MOBILE_PRIMARY: readonly DeskNavId[] = [
  "overview",
  "inbox",
  "leads",
  "knowledge",
];

/** Existing Widget page tab id. Post-payment opens this tab directly. */
export const WIDGET_INSTALL_TAB = "install";

export function widgetDeskTab(tab: string | string[] | undefined): "appearance" | "install" {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return value === WIDGET_INSTALL_TAB ? WIDGET_INSTALL_TAB : "appearance";
}

export function widgetInstallDeskHref() {
  return `/app/widget?tab=${WIDGET_INSTALL_TAB}`;
}

export function pathMatchesHref(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isDeskNavActive(pathname: string, item: DeskNavItem) {
  if (pathMatchesHref(pathname, item.href)) return true;
  return (item.aliases ?? []).some((alias) => pathMatchesHref(pathname, alias));
}

export function deskNavById(id: DeskNavId) {
  return DESK_NAV.find((item) => item.id === id)!;
}

export function deskPageTitle(pathname: string) {
  const active = DESK_NAV.find((item) => isDeskNavActive(pathname, item));
  return active?.label ?? "Workspace";
}
