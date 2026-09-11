"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WIDGET_CHAT_API_PATH } from "@/lib/widget-preview";
import { useEffect, useState } from "react";

type ChatRow = { role: "visitor" | "assistant"; content: string };

export function WidgetChat({ widgetKey }: { widgetKey: string }) {
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

  return (
    <div className="flex h-dvh flex-col bg-white text-neutral-900">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-medium">Chat</p>
        <p className="text-xs text-neutral-500">Powered by BizPilot Pro</p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
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
        className="flex gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(draft);
        }}
      >
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message…" />
        <Button type="submit" disabled={pending || !visitorKey} aria-busy={pending}>
          {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
