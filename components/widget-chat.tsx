"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildWidgetHostMessage } from "@/lib/widget-embed-script";
import { WIDGET_CHAT_API_PATH } from "@/lib/widget-preview";
import { MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

type ChatRow = { role: "visitor" | "assistant"; content: string };

function notifyHost(type: "open" | "close") {
  if (typeof window === "undefined") return;
  window.parent.postMessage(buildWidgetHostMessage(type), "*");
}

export function WidgetChat({
  widgetKey,
  startOpen = false,
}: {
  widgetKey: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [visitorKey, setVisitorKey] = useState("");
  const [draft, setDraft] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const existing = window.sessionStorage.getItem("bizpilot-visitor");
    const key = existing ?? crypto.randomUUID();
    if (!existing) window.sessionStorage.setItem("bizpilot-visitor", key);
    queueMicrotask(() => {
      if (!cancelled) setVisitorKey(key);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    notifyHost(open ? "open" : "close");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending || !visitorKey) return;
    setDraft("");
    setError("");
    setRows((current) => [...current, { role: "visitor", content: trimmed }]);
    setPending(true);
    try {
      const response = await fetch(WIDGET_CHAT_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey,
          visitorKey,
          conversationId,
          question: trimmed,
        }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        conversationId?: string;
        error?: string;
      };
      if (payload.conversationId) setConversationId(payload.conversationId);
      if (!response.ok && !payload.answer) {
        setError(payload.error || "The live widget could not answer.");
        return;
      }
      setRows((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.answer || payload.error || "I could not answer just now.",
        },
      ]);
    } catch {
      setError("The live widget could not be reached.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="flex h-full w-full items-end justify-end bg-transparent">
        <button
          type="button"
          aria-label="Open chat"
          onClick={() => {
            notifyHost("open");
            setOpen(true);
          }}
          className="flex size-14 items-center justify-center rounded-full bg-teal-800 text-white shadow-[0_8px_24px_rgba(15,23,42,0.28)]"
        >
          <MessageCircle className="size-6" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-none">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">Chat</p>
          <p className="text-xs text-neutral-500">Powered by BizPilot Pro</p>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          onClick={() => setOpen(false)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-800 shadow-sm hover:bg-neutral-50"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {rows.length === 0 && !error ? (
          <p className="rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-600">
            Ask a question. If this business’s monthly AI allowance is used, you’ll be offered a
            person instead.
          </p>
        ) : null}
        {rows.map((row, index) => (
          <div
            key={`${row.role}-${index}`}
            className={
              row.role === "visitor"
                ? "ml-8 rounded-2xl bg-neutral-900 px-3 py-2 text-sm text-white"
                : "mr-8 rounded-2xl bg-neutral-100 px-3 py-2 text-sm"
            }
          >
            {row.content}
          </div>
        ))}
        {pending ? (
          <p className="text-xs text-neutral-500" aria-live="polite">
            Looking that up…
          </p>
        ) : null}
        {error ? (
          <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <form
        className="sticky bottom-0 z-10 flex shrink-0 gap-2 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          aria-label="Message"
          className="h-11 min-h-11 flex-1 text-base md:h-9 md:min-h-9"
        />
        <Button
          type="submit"
          disabled={pending || !visitorKey}
          aria-busy={pending}
          className="h-11 min-h-11 px-4 md:h-9"
        >
          {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
