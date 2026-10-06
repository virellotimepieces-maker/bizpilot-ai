import { DESK_NAV } from "@/lib/ui/desk-nav";
import { PRODUCT_PREVIEW_LABEL } from "@/lib/marketing/copy";
import { MessageCircle } from "lucide-react";

const SAMPLE_MESSAGES = [
  {
    role: "visitor" as const,
    text: "What time do you open on Saturday?",
  },
  {
    role: "assistant" as const,
    text: "Saturday hours are 9:00–14:00.",
  },
  {
    role: "visitor" as const,
    text: "Can I get a quote for a kitchen install?",
  },
  {
    role: "assistant" as const,
    text: "I can take your details and send the request to the business. I will not confirm a price or a booking from chat.",
  },
];

const SAMPLE_THREADS = [
  { from: "Website", status: "Open", preview: "Quote request — kitchen install" },
  { from: "Website", status: "Waiting on you", preview: "Talk to a person" },
];

const SAMPLE_LEADS = [
  { name: "Maya R.", intent: "Quote request", status: "New" },
  { name: "Jordan P.", intent: "Hours question", status: "Follow-up" },
];

export function ProductPreview() {
  return (
    <div className="min-w-0">
      <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {PRODUCT_PREVIEW_LABEL}
        </p>
        <p className="text-xs text-muted-foreground">Your workspace and the website widget</p>
      </div>
      <div className="rounded-2xl border bg-[linear-gradient(165deg,oklch(0.995_0.004_264),oklch(0.95_0.02_264))] p-3 shadow-[0_28px_60px_-32px_oklch(0.28_0.08_264/0.65)] sm:p-5">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)] lg:items-stretch">
          <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-[0_10px_30px_-18px_oklch(0.22_0.06_264/0.45)]">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2.5">
              <span className="flex gap-1" aria-hidden="true">
                <span className="size-2 rounded-full bg-border" />
                <span className="size-2 rounded-full bg-border" />
                <span className="size-2 rounded-full bg-border" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">Inbox</p>
                <p className="text-xs text-muted-foreground">Workspace layout</p>
              </div>
              <span className="ml-auto rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                Sample
              </span>
            </div>
            <div className="grid min-w-0 sm:grid-cols-[12rem_minmax(0,1fr)]">
              <nav className="hidden border-r bg-sidebar p-2 sm:block" aria-hidden="true">
                <ul className="grid gap-0.5">
                  {DESK_NAV.slice(0, 6).map((item) => {
                    const Icon = item.icon;
                    const active = item.id === "inbox";
                    return (
                      <li
                        key={item.id}
                        className={
                          active
                            ? "flex items-center gap-2 rounded-md bg-sidebar-accent px-2.5 py-2 text-sm font-medium text-sidebar-accent-foreground"
                            : "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground"
                        }
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {item.label}
                      </li>
                    );
                  })}
                </ul>
              </nav>
              <div className="min-w-0 p-3 sm:p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase">Open threads</p>
                <ul className="mt-2 grid gap-2">
                  {SAMPLE_THREADS.map((thread) => (
                    <li key={thread.preview} className="min-w-0 rounded-lg border bg-background px-3 py-2.5">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">{thread.from}</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                          {thread.status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm">{thread.preview}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs font-medium text-muted-foreground uppercase">Leads</p>
                <ul className="mt-2 grid gap-2">
                  {SAMPLE_LEADS.map((lead) => (
                    <li key={lead.name} className="flex min-w-0 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{lead.name}</span>
                        <span className="text-xs text-muted-foreground">{lead.intent}</span>
                      </span>
                      <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                        {lead.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-sm min-w-0 flex-col justify-end lg:mx-0 lg:max-w-none">
            <div className="flex h-[28rem] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-[0_16px_40px_-18px_rgba(15,23,42,0.45)]">
              <div className="flex shrink-0 items-center gap-2 bg-primary px-3 py-3 text-primary-foreground">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/15">
                  <MessageCircle className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Chat</p>
                  <p className="text-xs text-primary-foreground/80">Powered by Bizlyro AI</p>
                </div>
                <span className="ml-auto rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-medium">
                  Sample
                </span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[linear-gradient(180deg,#fff,oklch(0.985_0.004_264))] p-3">
                {SAMPLE_MESSAGES.map((row) => (
                  <p
                    key={row.text}
                    className={
                      row.role === "visitor"
                        ? "ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground"
                        : "mr-auto w-fit max-w-[90%] rounded-2xl border border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-sm leading-relaxed text-neutral-800"
                    }
                  >
                    {row.text}
                  </p>
                ))}
              </div>
              <div className="flex shrink-0 gap-2 border-t bg-white p-3">
                <span className="flex h-11 min-h-11 min-w-0 flex-1 items-center rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-400">
                  Message…
                </span>
                <span className="inline-flex h-11 min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
                  Send
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
