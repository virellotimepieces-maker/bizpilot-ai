import { knowledgeCoverage } from "@/lib/completeness";
import type { KnowledgeBase } from "@/lib/types";

export type SetupItem = {
  key: string;
  label: string;
  done: boolean;
  hint: string;
};

export function workspaceSetup(input: {
  knowledge: KnowledgeBase | null;
  websiteVerified: boolean;
  websitePageCount: number;
  waitingOnHuman: number;
}): { items: SetupItem[]; readyForWidget: boolean } {
  const coverage = knowledgeCoverage(input.knowledge);
  const named = Boolean(input.knowledge?.name.trim() && input.knowledge?.description.trim());
  const contacted = Boolean(
    input.knowledge?.contact.email.trim() || input.knowledge?.contact.phone.trim(),
  );
  const items: SetupItem[] = [
    {
      key: "knowledge",
      label: "Teach BizPilot the business",
      done: named,
      hint: named
        ? `${coverage.percent}% of the knowledge checklist is filled.`
        : "Add the business name and a public description before the widget answers.",
    },
    {
      key: "contact",
      label: "Publish a way to reach you",
      done: contacted,
      hint: contacted
        ? "Chat can share the published phone or email."
        : "Add a support email or phone on Knowledge → Contact.",
    },
    {
      key: "website",
      label: "Verify the website",
      done: input.websiteVerified,
      hint: input.websiteVerified
        ? "Domain verified. The widget script matched this workspace."
        : "Install the widget and verify the public domain so answers stay on your site.",
    },
    {
      key: "sync",
      label: "Index public pages",
      done: input.websitePageCount > 0,
      hint:
        input.websitePageCount > 0
          ? `${input.websitePageCount} public page${input.websitePageCount === 1 ? "" : "s"} indexed.`
          : "Sync the website after verification. A sync with 0 pages is a failure.",
    },
    {
      key: "queue",
      label: "Human queue is clear",
      done: input.waitingOnHuman === 0,
      hint:
        input.waitingOnHuman === 0
          ? "No website visitors are waiting on a teammate."
          : `${input.waitingOnHuman} conversation${input.waitingOnHuman === 1 ? "" : "s"} waiting in Inbox.`,
    },
  ];
  return {
    items,
    readyForWidget: named && contacted,
  };
}
