import { DESK_NAV } from "@/lib/ui/desk-nav";
import { PRODUCT_PREVIEW_LABEL } from "@/lib/marketing/copy";

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
      <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {PRODUCT_PREVIEW_LABEL}
      </p>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
        <div className="min-w-0 overflow-hidden rounded-lg border bg-card shadow-[0_1px_2px_oklch(0.22_0.03_264/0.04)]">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Inbox</p>
              <p className="text-xs text-muted-foreground">Paid desk layout</p>
            </div>
            <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              Sample
            </span>
          </div>
          <div className="grid min-w-0 sm:grid-cols-[11rem_minmax(0,1fr)]">
            <nav className="hidden border-r bg-sidebar p-2 sm:block" aria-hidden="true">
              <ul className="grid gap-0.5">
                {DESK_NAV.slice(0, 6).map((item) => (
                  <li
                    key={item.id}
                    className={
                      item.id === "inbox"
                        ? "rounded-md bg-sidebar-accent px-2.5 py-2 text-sm font-medium"
                        : "rounded-md px-2.5 py-2 text-sm text-muted-foreground"
                    }
                  >
                    {item.label}
                  </li>
                ))}
              </ul>
            </nav>
            <div className="min-w-0 p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Open threads</p>
              <ul className="mt-2 grid gap-2">
                {SAMPLE_THREADS.map((thread) => (
                  <li key={thread.preview} className="min-w-0 rounded-md border bg-background px-3 py-2">
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
                  <li key={lead.name} className="flex min-w-0 items-center justify-between gap-2 rounded-md border bg-background px-3 py-2">
                    <span className="min-w-0 truncate text-sm font-medium">{lead.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{lead.intent}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm min-w-0 flex-col justify-end">
          <div className="flex h-[28rem] min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-[0_8px_24px_rgba(15,23,42,0.12)]">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">Chat</p>
                <p className="text-xs text-neutral-500">Powered by Bizlyro AI</p>
              </div>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {SAMPLE_MESSAGES.map((row) => (
                <p
                  key={row.text}
                  className={
                    row.role === "visitor"
                      ? "ml-8 rounded-2xl bg-neutral-900 px-3 py-2 text-sm text-white"
                      : "mr-8 rounded-2xl bg-neutral-100 px-3 py-2 text-sm"
                  }
                >
                  {row.text}
                </p>
              ))}
            </div>
            <div className="flex shrink-0 gap-2 border-t bg-white p-3">
              <span className="h-11 min-h-11 flex-1 rounded-md border border-neutral-200 bg-neutral-50 px-3 text-sm leading-11 text-neutral-400">
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
  );
}
