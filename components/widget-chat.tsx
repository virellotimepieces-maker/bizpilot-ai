"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  presentAssistantMessage,
  visibleProductCards,
  type WidgetProductCard,
} from "@/lib/widget-message-view";
import { isNearBottom, scrollMessagesToLatest } from "@/lib/widget-chat-scroll";
import { buildWidgetHostMessage } from "@/lib/widget-embed-script";
import { WIDGET_CHAT_API_PATH, WIDGET_PUBLIC_SETTINGS_PATH } from "@/lib/widget-preview";
import {
  fillWidgetChrome,
  WIDGET_CHROME_EN,
  widgetTextDirection,
  type WidgetChrome,
} from "@/lib/i18n/widget-chrome";
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

type ChatSource = {
  title?: string;
  url?: string;
  kind?: string;
  price?: string;
  description?: string;
  imageUrl?: string;
  slotStart?: string;
};

function slotChoices(sources?: ChatSource[] | null) {
  if (!sources) return [];
  return sources.flatMap((source) => {
    if (!source.url?.startsWith("slot:") || !source.title) return [];
    return [{ label: source.title, start: source.url.slice(5) }];
  });
}

type ChatRow = {
  id?: string;
  role: "visitor" | "assistant" | "human" | "system";
  content: string;
  sources?: ChatSource[] | null;
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
  messages: { id?: string; role?: string; content?: string; sources?: ChatSource[] | null }[],
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
      sources: Array.isArray(row.sources) ? row.sources : null,
    }));
}

function ProductCard({
  card,
  accent,
  viewLabel,
}: {
  card: WidgetProductCard;
  accent: string;
  viewLabel: string;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
      {card.imageUrl ? (
        // Shopify image hosts are not in next/image remotePatterns; the embed uses the raw src.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={card.imageUrl}
          alt=""
          className="h-28 w-full rounded-t-lg bg-neutral-100 object-contain"
          onError={(event) => {
            event.currentTarget.remove();
          }}
        />
      ) : null}
      <div className="px-3 pt-2 pb-2.5">
        <h3 className="break-words text-sm font-semibold leading-snug text-neutral-950">{card.name}</h3>
        {card.price ? <p className="mt-1 text-sm font-medium text-neutral-800">{card.price}</p> : null}
        {card.description ? (
          <p className="mt-1 line-clamp-3 break-words text-sm leading-relaxed text-neutral-600">{card.description}</p>
        ) : null}
        {card.href ? (
          <a
            href={card.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-lg border px-3 text-sm font-medium"
            style={{ borderColor: accent, color: accent }}
          >
            {viewLabel}
          </a>
        ) : null}
      </div>
    </article>
  );
}

function headerSubtitle(
  appearance: PublicWidgetAppearance,
  waitingOnHuman: boolean,
  chrome: WidgetChrome,
) {
  if (waitingOnHuman) return chrome.teammateWillReply || "A teammate will reply here";
  if (appearance.identifyAsAi) {
    return appearance.businessDisplayName
      ? fillWidgetChrome(chrome.assistantFor || "AI assistant for {business}", {
          business: appearance.businessDisplayName,
        })
      : chrome.assistant || DEFAULT_AI_IDENTIFICATION;
  }
  return appearance.businessDisplayName || chrome.chat || "Chat";
}

function chromeFromPayload(chrome: Partial<WidgetChrome> | null | undefined) {
  const next: WidgetChrome = { ...WIDGET_CHROME_EN };
  if (!chrome) return next;
  for (const key of Object.keys(WIDGET_CHROME_EN) as (keyof WidgetChrome)[]) {
    const value = chrome[key];
    if (typeof value === "string" && value.trim()) next[key] = value;
  }
  return next;
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
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});
  const [language, setLanguage] = useState("en");
  const [chrome, setChrome] = useState<WidgetChrome>(WIDGET_CHROME_EN);
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

  const applyUi = useCallback((payload: { detectedLanguage?: string; chrome?: Partial<WidgetChrome> | null }) => {
    if (payload.detectedLanguage) setLanguage(payload.detectedLanguage);
    if (payload.chrome) setChrome(chromeFromPayload(payload.chrome));
  }, []);

  const syncThread = useCallback(async () => {
    if (!visitorKey || !widgetKey) return;
    const params = new URLSearchParams({ widgetKey, visitorKey });
    if (conversationId) params.set("conversationId", conversationId);
    const response = await fetch(`${WIDGET_CHAT_API_PATH}?${params.toString()}`);
    const payload = (await response.json()) as {
      conversationId?: string | null;
      waitingOnHuman?: boolean;
      messages?: { id?: string; role?: string; content?: string; sources?: ChatSource[] | null }[];
      contact?: { name?: string; email?: string; phone?: string } | null;
      detectedLanguage?: string;
      chrome?: Partial<WidgetChrome> | null;
    };
    if (!response.ok) return;
    applyUi(payload);
    if (payload.conversationId) setConversationId(payload.conversationId);
    setWaitingOnHuman(Boolean(payload.waitingOnHuman));
    if (payload.messages?.length) {
      setRows(rowsFromMessages(payload.messages));
    }
    if (payload.contact?.name || payload.contact?.email) {
      setContactSaved(true);
    }
  }, [applyUi, conversationId, visitorKey, widgetKey]);

  useEffect(() => {
    if (!open || !visitorKey) return;
    const timer = window.setInterval(() => {
      void syncThread();
    }, 2500);
    queueMicrotask(() => {
      void syncThread();
    });
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
        detectedLanguage?: string;
        chrome?: Partial<WidgetChrome> | null;
      };
      applyUi(payload);
      if (!response.ok) {
        setError(payload.error || chrome.saveContactError || "Could not save your contact details.");
        return;
      }
      if (payload.conversationId) setConversationId(payload.conversationId);
      setContactSaved(true);
      setContactOpen(false);
    } catch {
      setError(chrome.saveContactError || "Could not save your contact details.");
    } finally {
      setContactPending(false);
    }
  }

  async function send(question: string, slotStart?: string) {
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
          slotStart,
          contact: contactPayload(),
        }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        conversationId?: string;
        waitingOnHuman?: boolean;
        error?: string;
        contactSaved?: boolean;
        sources?: ChatSource[] | null;
        detectedLanguage?: string;
        chrome?: Partial<WidgetChrome> | null;
      };
      applyUi(payload);
      if (payload.conversationId) setConversationId(payload.conversationId);
      setWaitingOnHuman(Boolean(payload.waitingOnHuman));
      if (payload.contactSaved || contactPayload()) setContactSaved(true);
      if (!response.ok && !payload.answer) {
        setError(payload.error || chrome.answerError || "The live widget could not answer.");
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
              content: payload.answer || payload.error || chrome.answerNowError || "I could not answer just now.",
              sources: Array.isArray(payload.sources) ? payload.sources : null,
            },
          ];
        });
      }
    } catch {
      setError(chrome.reachError || "The live widget could not be reached.");
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
      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
        detectedLanguage?: string;
        chrome?: Partial<WidgetChrome> | null;
      };
      applyUi(payload);
      if (!response.ok) {
        setError(payload.error || chrome.teammateError || "Could not reach a teammate.");
        return;
      }
      setWaitingOnHuman(true);
      if (payload.answer) {
        setRows((current) => [...current, { role: "system", content: payload.answer! }]);
      }
      await syncThread();
    } catch {
      setError(chrome.teammateError || "Could not reach a teammate.");
    } finally {
      setPending(false);
    }
  }

  const accent = appearance.accentColor || DEFAULT_WIDGET_ACCENT;
  const left = appearance.position === "bottom-left";
  const title = appearance.businessDisplayName || chrome.chat || "Chat";
  const direction = widgetTextDirection(language);
  const askPlaceholder =
    !appearance.placeholderPrompt || appearance.placeholderPrompt === "Ask a question"
      ? chrome.askQuestion || "Ask a question"
      : appearance.placeholderPrompt;
  const showWelcome = rows.length === 0;
  const showSuggestions = showWelcome && appearance.suggestedQuestions.length > 0 && !pending;

  if (!open) {
    return (
      <div
        dir={direction}
        className={`flex h-full w-full items-end bg-transparent ${left ? "justify-start" : "justify-end"}`}
      >
        <button
          type="button"
          aria-label={chrome.openChat || "Open chat"}
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
      dir={direction}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-none"
      style={{ ["--widget-accent" as string]: accent }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2 text-white"
        style={{ backgroundColor: accent }}
      >
        <div className="flex min-w-0 items-center gap-2">
          {appearance.logoUrl ? (
            // Customer logo URLs are not in next/image remotePatterns; embed iframe uses the raw src.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={appearance.logoUrl}
              alt=""
              className="size-8 shrink-0 rounded-full bg-white object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="truncate text-xs text-white/80">{headerSubtitle(appearance, waitingOnHuman, chrome)}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label={chrome.closeChat || "Close chat"}
          onClick={() => setOpen(false)}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/40 bg-white/10 text-white hover:bg-white/20"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-2.5 py-2"
        onScroll={() => {
          const scroller = scrollerRef.current;
          if (scroller) pinToBottomRef.current = isNearBottom(scroller);
        }}
      >
        <div ref={contentRef} className="space-y-2">
          {showWelcome ? (
            <p className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm leading-relaxed text-neutral-700">
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
          {rows.map((row, index) => {
            const key = row.id ?? `${row.role}-${index}`;
            const assistantView = row.role === "assistant" ? presentAssistantMessage(row.content, row.sources) : null;
            const shownProducts = assistantView
              ? visibleProductCards(assistantView.products, Boolean(expandedProducts[key]))
              : [];
            const hiddenProducts = assistantView ? assistantView.products.length - shownProducts.length : 0;
            return (
              <div
                key={key}
                className={
                  row.role === "visitor"
                    ? "ml-auto w-fit max-w-[85%] min-w-0 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words text-white"
                    : row.role === "human"
                      ? "mr-auto max-w-full min-w-0 rounded-2xl border border-neutral-200 px-3.5 py-2.5 text-sm leading-relaxed break-words text-neutral-900"
                      : row.role === "system"
                        ? "max-w-full min-w-0 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed break-words text-amber-950"
                        : "mr-auto w-full max-w-full min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm leading-relaxed break-words text-neutral-800"
                }
                style={
                  row.role === "visitor"
                    ? { backgroundColor: accent }
                    : row.role === "human"
                      ? { backgroundColor: "color-mix(in srgb, var(--widget-accent) 12%, white)" }
                      : undefined
                }
              >
                {row.role === "human" ? (
                  <p className="mb-1 text-[11px] font-medium">{chrome.team || "Team"}</p>
                ) : null}
                {assistantView && (assistantView.prose || assistantView.products.length) ? (
                  <div className="grid min-w-0 gap-2">
                    {assistantView.prose ? (
                      <p className="whitespace-pre-wrap break-words">{assistantView.prose}</p>
                    ) : null}
                    {shownProducts.length ? (
                      <div className="grid min-w-0 gap-2">
                        {shownProducts.map((card) => (
                          <ProductCard
                            key={`${card.name}-${card.href ?? "product"}`}
                            card={card}
                            accent={accent}
                            viewLabel={chrome.viewProduct || "View Product"}
                          />
                        ))}
                      </div>
                    ) : null}
                    {index === rows.length - 1 && row.role === "assistant" && slotChoices(row.sources).length ? (
                      <div className="grid min-w-0 gap-2">
                        {slotChoices(row.sources).map((slot) => (
                          <button
                            key={slot.start}
                            type="button"
                            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-800"
                            onClick={() => void send(slot.label, slot.start)}
                            disabled={pending || !visitorKey}
                          >
                            {slot.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {hiddenProducts > 0 ? (
                      <button
                        type="button"
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-neutral-200 bg-white px-3 text-sm font-medium text-neutral-800"
                        onClick={() => setExpandedProducts((current) => ({ ...current, [key]: true }))}
                      >
                        {fillWidgetChrome(chrome.showMore || "Show {count} more", {
                          count: String(hiddenProducts),
                        })}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{assistantView ? assistantView.prose : row.content}</p>
                )}
              </div>
            );
          })}
          {pending ? (
            <p className="text-xs text-neutral-500" aria-live="polite">
              {chrome.lookingUp || "Looking that up…"}
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
            {contactOpen
              ? chrome.hideContact || "Hide contact details"
              : chrome.leaveContact || "Leave your name and email (optional)"}
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
                placeholder={chrome.name || "Name"}
                aria-label={chrome.name || "Name"}
                className="h-10 min-h-10 text-sm"
              />
              <Input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder={chrome.email || "Email"}
                aria-label={chrome.email || "Email"}
                className="h-10 min-h-10 text-sm"
              />
              {appearance.collectPhone ? (
                <Input
                  type="tel"
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder={chrome.phone || "Phone"}
                  aria-label={chrome.phone || "Phone"}
                  className="h-10 min-h-10 text-sm"
                />
              ) : null}
              <Button type="submit" size="sm" disabled={contactPending || !visitorKey} className="h-10">
                {contactPending ? chrome.saving || "Saving…" : chrome.saveContact || "Save contact"}
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
            {chrome.talkToPerson || "Talk to a person"}
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
          placeholder={askPlaceholder}
          aria-label={chrome.message || "Message"}
          className="h-11 min-h-11 flex-1 text-base md:h-9 md:min-h-9"
        />
        <Button
          type="submit"
          disabled={pending || !visitorKey}
          aria-busy={pending}
          className="h-11 min-h-11 px-4 md:h-9"
          style={{ backgroundColor: accent }}
        >
          {pending ? chrome.sending || "Sending…" : chrome.send || "Send"}
        </Button>
      </form>
    </div>
  );
}
