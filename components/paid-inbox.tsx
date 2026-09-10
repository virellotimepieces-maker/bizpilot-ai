"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";

type Conversation = {
  id: string;
  visitorKey: string;
  waitingOnHuman: boolean;
  messages: { id: string; role: string; content: string }[];
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

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <div>
        <p className="text-xs tracking-[0.2em] text-primary uppercase">Conversation inbox</p>
        <h1 className="font-heading mt-2 text-3xl">Website widget conversations</h1>
      </div>
      {conversations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
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
                <p key={message.id}>
                  <span className="text-muted-foreground">{message.role}: </span>
                  {message.content}
                </p>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
