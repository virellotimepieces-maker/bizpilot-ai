"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isNearBottom, scrollMessagesToLatest } from "@/lib/widget-chat-scroll";
import { buildWidgetHostMessage } from "@/lib/widget-embed-script";
import { WIDGET_CHAT_API_PATH } from "@/lib/widget-preview";
import { MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatRow = {
  id?: string;
  role: "visitor" | "assistant" | "human" | "system";
  content: string;
};

function notifyHost(type: "open" | "close") {
  if (typeof window === "undefined") return;
  window.parent.postMessage(buildWidgetHostMessage(type), "*");
}

function rowsFromMessages(
  messages: { id?: string; role?: string; content?: string }[],
): ChatRow[] {
  return messages
    .filter((row) => row.content?.trim())
    .map((row) => ({
      id: row.id,
      role:
        row.role === "visitor"
          ? "visitor"
          : row.role === "human"
            ? "human"
            : row.role === "system"
              ? "system"
              : "assistant",
      content: row.content ?? "",
    }));
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
  const [waitingOnHuman, setWaitingOnHuman] = useState(false);
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const pinToBottomRef = useRef(true);

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

  useEffect(() => {
    if (!open) return;
    pinToBottomRef.current = true;
    scrollMessagesToLatest(bottomAnchorRef.current);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!pinToBottomRef.current) return;
    scrollMessagesToLatest(bottomAnchorRef.current);
  }, [open, rows, pending, error]);

  useEffect(() => {
    if (!open) return;
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (!pinToBottomRef.current) return;
      scrollMessagesToLatest(bottomAnchorRef.current);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [open]);

  const syncThread = useCallback(async () => {
    if (!visitorKey || !widgetKey) return;
    const params = new URLSearchParams({ widgetKey, visitorKey });
    if (conversationId) params.set("conversationId", conversationId);
    const response = await fetch(`${WIDGET_CHAT_API_PATH}?${params.toString()}`);
    const payload = (await response.json()) as {
      conversationId?: string | null;
      waitingOnHuman?: boolean;
      messages?: { id?: string; role?: string; content?: string }[];
    };
    if (!response.ok) return;
    if (payload.conversationId) setConversationId(payload.conversationId);
    setWaitingOnHuman(Boolean(payload.waitingOnHuman));
    if (payload.messages?.length) {
      setRows(rowsFromMessages(payload.messages));
    }
  }, [conversationId, visitorKey, widgetKey]);

  useEffect(() => {
    if (!open || !visitorKey) return;
    void syncThread();
    const timer = window.setInterval(() => {
      void syncThread();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [open, visitorKey, syncThread]);

  async function send(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending || !visitorKey) return;
    setDraft("");
    setError("");
    pinToBottomRef.current = true;
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
        waitingOnHuman?: boolean;
        error?: string;
      };
      if (payload.conversationId) setConversationId(payload.conversationId);
      setWaitingOnHuman(Boolean(payload.waitingOnHuman));
      if (!response.ok && !payload.answer) {
        setError(payload.error || "The live widget could not answer.");
        return;
      }
      await syncThread();
      if (!payload.waitingOnHuman && payload.answer) {
        setRows((current) => {
          if (current.some((row) => row.role !== "visitor" && row.content === payload.answer)) {
            return current;
          }
          return [
            ...current,
            {
              role: "assistant",
              content: payload.answer || payload.error || "I could not answer just now.",
            },
          ];
        });
      }
    } catch {
      setError("The live widget could not be reached.");
    } finally {
      setPending(false);
    }
  }

  async function requestHuman() {
    if (!conversationId || pending || waitingOnHuman) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(WIDGET_CHAT_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey,
          visitorKey,
          conversationId,
          handoff: true,
        }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok) {
        setError(payload.error || "Could not reach a teammate.");
        return;
      }
      setWaitingOnHuman(true);
      if (payload.answer) {
        setRows((current) => [...current, { role: "system", content: payload.answer! }]);
      }
      await syncThread();
    } catch {
      setError("Could not reach a teammate.");
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
            pinToBottomRef.current = true;
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
          <p className="text-xs text-neutral-500">
            {waitingOnHuman ? "A teammate will reply here" : "Powered by BizPilot Pro"}
          </p>
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
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3"
        onScroll={() => {
          const scroller = scrollerRef.current;
          if (scroller) pinToBottomRef.current = isNearBottom(scroller);
        }}
      >
        <div ref={contentRef} className="space-y-2">
          {rows.length === 0 && !error ? (
            <p className="rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-600">
              Ask a question. If this business’s monthly AI allowance is used, you’ll be offered a
              person instead.
            </p>
          ) : null}
          {rows.map((row, index) => (
            <div
              key={row.id ?? `${row.role}-${index}`}
              className={
                row.role === "visitor"
                  ? "ml-8 rounded-2xl bg-neutral-900 px-3 py-2 text-sm text-white"
                  : row.role === "human"
                    ? "mr-8 rounded-2xl bg-teal-50 px-3 py-2 text-sm text-teal-950"
                    : row.role === "system"
                      ? "rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      : "mr-8 rounded-2xl bg-neutral-100 px-3 py-2 text-sm"
              }
            >
              {row.role === "human" ? <p className="mb-1 text-[11px] font-medium">Team</p> : null}
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
        <div ref={bottomAnchorRef} data-widget-scroll-anchor="" aria-hidden="true" />
      </div>
      {conversationId && !waitingOnHuman ? (
        <div className="border-t px-3 py-2">
          <button
            type="button"
            className="text-xs text-teal-800 underline-offset-2 hover:underline"
            onClick={() => void requestHuman()}
            disabled={pending}
          >
            Talk to a person
          </button>
        </div>
      ) : null}
      <form
        className="flex shrink-0 gap-2 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
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
