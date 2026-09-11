"use client";

import { SetupGate } from "@/components/setup-gate";
import { SourcePills } from "@/components/source-pills";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INTENT_LABEL } from "@/lib/intent-labels";
import { BUSINESS_TYPE_LABEL } from "@/lib/labels";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS, PAGE_TITLE_CLASS, SECTION_HEADING_CLASS } from "@/lib/ui/type-scale";
import { PRESETS } from "@/lib/presets";
import type { BusinessType, ChatMessage, KnowledgeBase } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import { RotateCcw, Send } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

export function ChatStudio() {
  return (
    <SetupGate
      title="Preview website chat"
      description="The widget on the right reads the same knowledge base as email and social drafts. Safe, published facts can be answered automatically. Everything else is handed to a human."
    >
      <ChatBody />
    </SetupGate>
  );
}

function ChatBody() {
  const { knowledge, activeChat, sendVisitorMessage, resetChat, presetId } = useWorkspace();
  const [draft, setDraft] = useState("");
  if (!knowledge) return null;

  const preset = PRESETS.find((p) => p.id === presetId);
  const questions = preset?.suggestedQuestions ?? [
    "What are your hours?",
    "How do I get in touch?",
    "What do you offer?",
  ];

  const lastAssistant = [...(activeChat?.messages ?? [])]
    .reverse()
    .find((m) => m.role === "assistant");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    sendVisitorMessage(draft);
    setDraft("");
  }

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Website chat</p>
          <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>Customer site + operator view</h1>
          <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS}`}>
            Left: what a visitor sees on {knowledge.name}. Right: whether BizPilot answered from
            the knowledge base or asked a human to step in. Email is not sent from here.
          </p>
        </div>
        <Button variant="outline" onClick={resetChat}>
          <RotateCcw className="size-4" />
          Reset conversation
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <CustomerSite knowledge={knowledge}>
          <div className="flex h-[min(36rem,70vh)] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <p className="text-sm font-medium">Chat with {knowledge.name}</p>
                <p className="text-xs text-neutral-500">Powered by BizPilot · same knowledge as email and social</p>
              </div>
              <Badge variant="secondary">Live demo</Badge>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 p-4">
              {(activeChat?.messages.length ?? 0) === 0 && (
                <div className="rounded-2xl bg-white p-3 text-sm leading-relaxed text-neutral-600 shadow-sm">
                  Hi — I can help with hours, {offeringWord(knowledge.businessType)}, published
                  prices, and policies. I won&apos;t guess, and I won&apos;t send email or post on social for you.
                </div>
              )}
              {activeChat?.messages.map((message) => (
                <Bubble key={message.id} message={message} />
              ))}
            </div>
            <div className="border-t bg-white p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {questions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="rounded-full border px-2.5 py-1 text-left text-xs text-neutral-600 hover:bg-neutral-50"
                    onClick={() => sendVisitorMessage(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
              <form onSubmit={onSubmit} className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Ask a question a customer would type…"
                />
                <Button type="submit" size="icon" aria-label="Send">
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          </div>
        </CustomerSite>

        <aside className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className={SECTION_HEADING_CLASS}>Operator view</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {BUSINESS_TYPE_LABEL[knowledge.businessType]} knowledge base ·{" "}
            {knowledge.escalation.autoAnswerChat
              ? "auto-answer is on for safe topics"
              : "auto-answer is off"}
          </p>
          {lastAssistant ? (
            <div className="mt-4 grid gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant={lastAssistant.autoAnswered ? "secondary" : "destructive"}>
                  {lastAssistant.autoAnswered ? "Answered automatically" : "Needs a human"}
                </Badge>
                {lastAssistant.intent ? (
                  <Badge variant="outline">{INTENT_LABEL[lastAssistant.intent]}</Badge>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Knowledge used
                </p>
                <div className="mt-2">
                  <SourcePills sources={lastAssistant.sources ?? []} />
                </div>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Edit the knowledge base and ask again — this widget does not have a separate product
                catalog. Email drafts on the next page use these same articles.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Try a suggested question. Hours and published prices should auto-answer. Complaints,
              emergencies, and clinical advice should not.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function offeringWord(type: BusinessType) {
  if (type === "online_store") return "products";
  if (type === "clinic") return "visits";
  return "services";
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "visitor";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
          mine ? "bg-neutral-900 text-white" : "bg-white text-neutral-800 shadow-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function CustomerSite({
  knowledge,
  children,
}: {
  knowledge: KnowledgeBase;
  children: React.ReactNode;
}) {
  const theme = useMemo(() => {
    if (knowledge.businessType === "clinic") {
      return {
        frame: "bg-[oklch(0.93_0.02_200)]",
        hero: "bg-[oklch(0.97_0.01_90)]",
        accent: "text-[oklch(0.38_0.07_200)]",
      };
    }
    if (knowledge.businessType === "online_store") {
      return {
        frame: "bg-[oklch(0.92_0.03_75)]",
        hero: "bg-[oklch(0.97_0.02_85)]",
        accent: "text-[oklch(0.4_0.08_55)]",
      };
    }
    return {
      frame: "bg-[oklch(0.91_0.03_165)]",
      hero: "bg-[oklch(0.97_0.015_95)]",
      accent: "text-[oklch(0.36_0.07_165)]",
    };
  }, [knowledge.businessType]);

  return (
    <div className={`relative overflow-hidden rounded-3xl ${theme.frame} p-3 sm:p-5`}>
      <div className={`rounded-2xl ${theme.hero} p-5 sm:p-8`}>
        <p className={`text-xs font-medium tracking-[0.2em] uppercase ${theme.accent}`}>
          Sample customer website
        </p>
        <h2 className={`${PAGE_TITLE_CLASS} mt-2 max-w-xl`}>{knowledge.name}</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-600">
          {knowledge.tagline || knowledge.description}
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          {knowledge.offerings
            .filter((o) => o.name)
            .slice(0, 3)
            .map((offering) => (
              <div key={offering.id} className="min-w-40 rounded-xl bg-white/80 p-3">
                <p className="font-medium">{offering.name}</p>
                <p className="text-xs text-neutral-500">{offering.price}</p>
              </div>
            ))}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
