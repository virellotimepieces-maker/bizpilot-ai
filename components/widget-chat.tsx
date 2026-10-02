"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isNearBottom, scrollMessagesToLatest } from "@/lib/widget-chat-scroll";
import { buildWidgetHostMessage } from "@/lib/widget-embed-script";
import { WIDGET_CHAT_API_PATH, WIDGET_PUBLIC_SETTINGS_PATH } from "@/lib/widget-preview";
import {
  DEFAULT_AI_IDENTIFICATION,
  DEFAULT_WIDGET_ACCENT,
  DEFAULT_WIDGET_WELCOME,
  defaultSuggestedQuestions,
  type PublicWidgetAppearance,
} from "@/lib/v2/widget-settings";
import type { WidgetPosition } from "@/lib/v2/enums";
import { MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ChatRow = {
  id?: string;
  role: "visitor" | "assistant" | "human" | "system";
  content: string;
};

const FALLBACK_APPEARANCE: PublicWidgetAppearance = {
  businessDisplayName: "",
  logoUrl: "",
  welcomeMessage: DEFAULT_WIDGET_WELCOME,
  suggestedQuestions: defaultSuggestedQuestions(),
  accentColor: DEFAULT_WIDGET_ACCENT,
  position: "bottom-right",
  identifyAsAi: true,
  collectPhone: false,
  leadCaptureEnabled: true,
  placeholderPrompt: "Ask a question",
};

function notifyHost(type: "open" | "close" | "config", position?: WidgetPosition) {
  if (typeof window === "undefined") return;
  window.parent.postMessage(buildWidgetHostMessage(type, position ? { position } : undefined), "*");
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

function headerSubtitle(appearance: PublicWidgetAppearance, waitingOnHuman: boolean) {
  if (waitingOnHuman) return "A teammate will reply here";
  if (appearance.identifyAsAi) {
    return appearance.businessDisplayName
      ? `${DEFAULT_AI_IDENTIFICATION} for ${appearance.businessDisplayName}`
      : DEFAULT_AI_IDENTIFICATION;
  }
  return appearance.businessDisplayName || "Chat";
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
  const [appearance, setAppearance] = useState<PublicWidgetAppearance>(FALLBACK_APPEARANCE);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [contactPending, setContactPending] = useState(false);
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
    let cancelled = false;
    void fetch(`${WIDGET_PUBLIC_SETTINGS_PATH}?widgetKey=${encodeURIComponent(widgetKey)}`)
      .then((response) => response.json())
      .then((payload: { appearance?: PublicWidgetAppearance; error?: string }) => {
        if (cancelled) return;
        if (payload.appearance) setAppearance(payload.appearance);
        if (payload.error) setError(payload.error);
      })
      .catch(() => {
        if (!cancelled) setAppearance(FALLBACK_APPEARANCE);
      });
    return () => {
      cancelled = true;
    };
  }, [widgetKey]);

  useEffect(() => {
    notifyHost("config", appearance.position);
  }, [appearance.position]);

  useEffect(() => {
    notifyHost(open ? "open" : "close", appearance.position);
  }, [open, appearance.position]);

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
      contact?: { name?: string; email?: string; phone?: string } | null;
    };
    if (!response.ok) return;
    if (payload.conversationId) setConversationId(payload.conversationId);
    setWaitingOnHuman(Boolean(payload.waitingOnHuman));
    if (payload.messages?.length) {
      setRows(rowsFromMessages(payload.messages));
    }
    if (payload.contact?.name || payload.contact?.email) {
      setContactSaved(true);
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

  function contactPayload() {
    if (!appearance.leadCaptureEnabled || contactSaved) return undefined;
    const name = contactName.trim();
    const email = contactEmail.trim();
    const phone = appearance.collectPhone ? contactPhone.trim() : "";
    if (!name && !email && !phone) return undefined;
    return { name, email, phone };
  }

  async function saveContact() {
    const contact = contactPayload();
    if (!contact || contactPending || !visitorKey) return;
    setContactPending(true);
    setError("");
    try {
      const response = await fetch(WIDGET_CHAT_API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widgetKey,
          visitorKey,
          conversationId,
          contact,
        }),
      });
      const payload = (await response.json()) as {
        conversationId?: string;
        contactSaved?: boolean;
        error?: string;
      };
      if (!response.ok) {
        setError(payload.error || "Could not save your contact details.");
        return;
      }
      if (payload.conversationId) setConversationId(payload.conversationId);
      setContactSaved(true);
      setContactOpen(false);
    } catch {
      setError("Could not save your contact details.");
    } finally {
      setContactPending(false);
    }
  }

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
          contact: contactPayload(),
        }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        conversationId?: string;
        waitingOnHuman?: boolean;
        error?: string;
        contactSaved?: boolean;
      };
      if (payload.conversationId) setConversationId(payload.conversationId);
      setWaitingOnHuman(Boolean(payload.waitingOnHuman));
      if (payload.contactSaved || contactPayload()) setContactSaved(true);
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

  const accent = appearance.accentColor || DEFAULT_WIDGET_ACCENT;
  const left = appearance.position === "bottom-left";
  const title = appearance.businessDisplayName || "Chat";
  const showWelcome = rows.length === 0 && !error;
  const showSuggestions = showWelcome && appearance.suggestedQuestions.length > 0 && !pending;

  if (!open) {
    return (
      <div
        className={`flex h-full w-full items-end bg-transparent ${left ? "justify-start" : "justify-end"}`}
      >
        <button
          type="button"
          aria-label="Open chat"
          onClick={() => {
            notifyHost("open", appearance.position);
            pinToBottomRef.current = true;
            setOpen(true);
          }}
          className="flex size-14 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(15,23,42,0.28)]"
          style={{ backgroundColor: accent }}
        >
          <MessageCircle className="size-6" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-none"
      style={{ ["--widget-accent" as string]: accent }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 text-white"
        style={{ backgroundColor: accent }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {appearance.logoUrl ? (
            <img
              src={appearance.logoUrl}
              alt=""
              className="size-8 shrink-0 rounded-full bg-white object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="truncate text-xs text-white/80">{headerSubtitle(appearance, waitingOnHuman)}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close chat"
          onClick={() => setOpen(false)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10 text-white hover:bg-white/20"
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
          {showWelcome ? (
            <p className="rounded-2xl bg-neutral-50 p-3 text-sm text-neutral-700">
              {appearance.welcomeMessage}
            </p>
          ) : null}
          {showSuggestions ? (
            <div className="flex flex-wrap gap-2">
              {appearance.suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs text-neutral-800 hover:border-neutral-400"
                  onClick={() => void send(question)}
                  disabled={pending || !visitorKey}
                >
                  {question}
                </button>
              ))}
            </div>
          ) : null}
          {rows.map((row, index) => (
            <div
              key={row.id ?? `${row.role}-${index}`}
              className={
                row.role === "visitor"
                  ? "ml-8 rounded-2xl bg-neutral-900 px-3 py-2 text-sm text-white"
                  : row.role === "human"
                    ? "mr-8 rounded-2xl px-3 py-2 text-sm"
                    : row.role === "system"
                      ? "rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"
                      : "mr-8 rounded-2xl bg-neutral-100 px-3 py-2 text-sm"
              }
              style={
                row.role === "human"
                  ? { backgroundColor: "color-mix(in srgb, var(--widget-accent) 14%, white)" }
                  : undefined
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
      {appearance.leadCaptureEnabled && !contactSaved ? (
        <div className="border-t px-3 py-2">
          <button
            type="button"
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: accent }}
            onClick={() => setContactOpen((current) => !current)}
          >
            {contactOpen ? "Hide contact details" : "Leave your name and email (optional)"}
          </button>
          {contactOpen ? (
            <form
              className="mt-2 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void saveContact();
              }}
            >
              <Input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Name"
                aria-label="Name"
                className="h-10 min-h-10 text-sm"
              />
              <Input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="Email"
                aria-label="Email"
                className="h-10 min-h-10 text-sm"
              />
              {appearance.collectPhone ? (
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="Phone"
                  aria-label="Phone"
                  className="h-10 min-h-10 text-sm"
                />
              ) : null}
              <Button type="submit" size="sm" disabled={contactPending || !visitorKey} className="h-10">
                {contactPending ? "Saving…" : "Save contact"}
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {conversationId && !waitingOnHuman ? (
        <div className="border-t px-3 py-2">
          <button
            type="button"
            className="text-xs underline-offset-2 hover:underline"
            style={{ color: accent }}
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
          placeholder={appearance.placeholderPrompt || "Ask a question"}
          aria-label="Message"
          className="h-11 min-h-11 flex-1 text-base md:h-9 md:min-h-9"
        />
        <Button
          type="submit"
          disabled={pending || !visitorKey}
          aria-busy={pending}
          className="h-11 min-h-11 px-4 md:h-9"
          style={{ backgroundColor: accent }}
        >
          {pending ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
