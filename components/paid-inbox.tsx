"use client";

import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS, PAGE_TITLE_CLASS } from "@/lib/ui/type-scale";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Conversation = {
  id: string;
  visitorKey: string;
  waitingOnHuman: boolean;
  messages: {
    id: string;
    role: string;
    content: string;
    sources?: { title: string; url: string }[] | null;
  }[];
};

export function PaidInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/app/inbox");
    const payload = (await response.json()) as { conversations?: Conversation[]; error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not load inbox.");
      return;
    }
    setError("");
    setConversations(payload.conversations ?? []);
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = useMemo(
    () => conversations.find((row) => row.id === selectedId) ?? conversations[0] ?? null,
    [conversations, selectedId],
  );

  async function sendReply() {
    if (!selected || !draft.trim() || pending) return;
    setPending(true);
    const response = await fetch("/api/app/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, content: draft }),
    });
    const payload = (await response.json()) as { error?: string };
    setPending(false);
    if (!response.ok) {
      toast.error(payload.error || "Could not send the reply");
      return;
    }
    setDraft("");
    toast.success("Reply sent to the website visitor");
    await load();
  }

  async function resumeAi() {
    if (!selected || pending) return;
    setPending(true);
    const response = await fetch("/api/app/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selected.id, resumeAi: true }),
    });
    setPending(false);
    if (!response.ok) {
      toast.error("Could not resume AI");
      return;
    }
    toast.message("AI replies are on again for this conversation");
    await load();
  }

  if (error && !conversations.length) {
    return <p className="text-sm text-destructive md:text-base">{error}</p>;
  }

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div>
        <p className="text-xs tracking-[0.2em] text-primary uppercase">Conversation inbox</p>
        <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>Website widget conversations</h1>
        <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS}`}>
          Reply here and the visitor sees it in the widget. AI pauses until you resume it. Email and
          social stay drafts —{" "}
          <Link href="/app/email" className="underline underline-offset-2">
            Email drafts
          </Link>{" "}
          and{" "}
          <Link href="/app/social" className="underline underline-offset-2">
            Social drafts
          </Link>
          .
        </p>
      </div>

      {conversations.length === 0 ? (
        <p className={HELPER_TEXT_CLASS}>
          No widget conversations yet. Install the widget, then customer messages appear here.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.4fr)]">
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-4 py-3 text-sm font-medium">Inbox</div>
            <div className="max-h-[70vh] overflow-y-auto">
              {conversations.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`block w-full border-b px-4 py-3 text-left last:border-b-0 ${
                    selected?.id === row.id ? "bg-muted/70" : "hover:bg-muted/40"
                  }`}
                >
                  <p className="truncate text-sm font-medium">{row.visitorKey.slice(0, 12)}…</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.waitingOnHuman ? "Waiting on you" : "AI can answer"}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {selected ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {selected.waitingOnHuman ? "AI paused — you are on this chat" : "AI is answering"}
                  </p>
                  {selected.waitingOnHuman ? (
                    <Button variant="outline" size="sm" onClick={() => void resumeAi()} disabled={pending}>
                      Resume AI
                    </Button>
                  ) : null}
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  {selected.messages.map((message) => (
                    <div key={message.id} className="grid gap-1">
                      <p>
                        <span className="text-muted-foreground">
                          {message.role === "human" ? "You" : message.role}:{" "}
                        </span>
                        {message.content}
                      </p>
                      {message.role === "assistant" && message.sources?.length ? (
                        <p className="text-xs text-muted-foreground">
                          Source:{" "}
                          {message.sources.map((source, index) => (
                            <span key={source.url}>
                              {index > 0 ? " · " : ""}
                              {source.title}
                            </span>
                          ))}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <Field label="Reply in the widget">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={5}
                    placeholder="This message appears in the visitor’s website chat."
                  />
                </Field>
                <Button className="mt-3" onClick={() => void sendReply()} disabled={pending || !draft.trim()}>
                  {pending ? "Sending…" : "Send to visitor"}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
