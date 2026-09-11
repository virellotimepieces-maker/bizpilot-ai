"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS, PAGE_TITLE_CLASS } from "@/lib/ui/type-scale";
import Link from "next/link";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    void fetch("/api/app/inbox")
      .then(async (response) => {
        const payload = (await response.json()) as { conversations?: Conversation[]; error?: string };
        if (!response.ok) {
          setError(payload.error || "Could not load inbox.");
          return;
        }
        setConversations(payload.conversations ?? []);
      });
  }, []);

  if (error) return <p className="text-sm text-destructive md:text-base">{error}</p>;

  return (
    <div className={`${PAGE_SHELL_CLASS} max-w-4xl`}>
      <div>
        <p className="text-xs tracking-[0.2em] text-primary uppercase">Conversation inbox</p>
        <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>Website widget conversations</h1>
        <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS}`}>
          Live Instagram, Facebook, TikTok, and Messenger inboxes are not connected.{" "}
          <Link href="/app/social" className="underline underline-offset-2">
            Paste those messages under Social drafts
          </Link>{" "}
          — BizPilot writes a reply and never posts it for you.
        </p>
      </div>
      {conversations.length === 0 ? (
        <p className={HELPER_TEXT_CLASS}>
          No widget conversations yet. Install the widget, then customer messages appear here.
        </p>
      ) : (
        conversations.map((conversation) => (
          <Card key={conversation.id}>
            <CardHeader>
              <CardTitle className="text-sm">
                {conversation.visitorKey}
                {conversation.waitingOnHuman ? " · waiting on a human" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {conversation.messages.map((message) => (
                <div key={message.id} className="grid gap-1">
                  <p>
                    <span className="text-muted-foreground">{message.role}: </span>
                    {message.content}
                  </p>
                  {message.role === "assistant" && message.sources?.length ? (
                    <p className="text-xs text-muted-foreground">
                      Internal source:{" "}
                      {message.sources.map((source, index) => (
                        <span key={source.url}>
                          {index > 0 ? " · " : ""}
                          {source.title} ({source.url})
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
