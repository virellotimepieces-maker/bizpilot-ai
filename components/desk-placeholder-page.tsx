import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

export function DeskPlaceholderPage({
  eyebrow,
  title,
  description,
  emptyTitle,
  emptyDescription,
  icon,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: LucideIcon;
  action?: { href: string; label: string };
}) {
  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        icon={icon}
        title={emptyTitle}
        description={emptyDescription}
        action={
          action ? (
            <Button size="sm" variant="outline" render={<Link href={action.href} />}>
              {action.label}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
