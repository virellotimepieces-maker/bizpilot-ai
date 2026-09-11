"use client";

import { Field } from "@/components/field";
import { SourcePills } from "@/components/source-pills";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { INTENT_LABEL } from "@/lib/intent-labels";
import {
  SOCIAL_PLATFORM_LABEL,
  SOCIAL_PLATFORMS,
  SOCIAL_STATUS_LABEL,
} from "@/lib/social";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS, PAGE_TITLE_CLASS } from "@/lib/ui/type-scale";
import type { ReplySource, SocialPlatform, SocialStatus } from "@/lib/types";
import { Copy, RefreshCw, Share2, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PaidSocialMessage = {
  id: string;
  platform: SocialPlatform;
  fromName: string;
  handle: string;
  body: string;
  conversationUrl: string | null;
  status: SocialStatus;
  draftBody: string;
  intent: keyof typeof INTENT_LABEL;
  sources: ReplySource[] | null;
  operatorNote: string;
  usedInternalKnowledge: boolean;
  createdAt: string;
};

export function PaidSocialInbox() {
  const [messages, setMessages] = useState<PaidSocialMessage[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [incoming, setIncoming] = useState({
    platform: "instagram" as SocialPlatform,
    fromName: "",
    handle: "",
    body: "",
    conversationUrl: "",
  });

  const load = useCallback(async () => {
    const response = await fetch("/api/app/social");
    const payload = (await response.json()) as { messages?: PaidSocialMessage[]; error?: string };
    if (!response.ok) {
      setError(payload.error || "Could not load social drafts.");
      setLoading(false);
      return;
    }
    setError("");
    setMessages(payload.messages ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => messages.find((row) => row.id === selectedId) ?? messages[0] ?? null,
    [messages, selectedId],
  );

  async function patch(id: string, body: { draftBody?: string; status?: SocialStatus; regenerate?: boolean }) {
    const response = await fetch("/api/app/social", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const payload = (await response.json()) as { message?: PaidSocialMessage; error?: string };
    if (!response.ok) {
      toast.error(payload.error || "Could not update the draft");
      return;
    }
    if (payload.message) {
      setMessages((prev) => prev.map((row) => (row.id === payload.message!.id ? payload.message! : row)));
    }
    if (body.regenerate) toast.success("Draft regenerated from the current knowledge base");
    if (body.status === "posted") toast.success("Marked as posted by you");
    if (body.status === "escalated") toast.message("Kept in the human queue");
    if (body.status === "discarded") toast.message("Draft discarded");
  }

  if (error && !messages.length && !loading) {
    return <p className="text-sm text-destructive md:text-base">{error}</p>;
  }

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Social support
          </p>
          <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>Drafts you post yourself</h1>
          <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS}`}>
            Paste an Instagram, Facebook, TikTok, or Messenger message. BizPilot writes a draft from
            your knowledge. Copy it, post it in the social app, then mark it posted here. There is
            no live Meta or TikTok connection.
          </p>
        </div>
        <Button variant="outline" onClick={() => setComposeOpen(true)}>
          <Share2 className="size-4" />
          Paste a received message
        </Button>
      </div>

      <Alert>
        <ShieldAlert />
        <AlertTitle>Human posting required</AlertTitle>
        <AlertDescription>
          BizPilot never posts to social networks. Website chat may answer safe questions on its
          own. Social stays a draft until you copy it.
        </AlertDescription>
      </Alert>

      {loading ? (
        <p className={HELPER_TEXT_CLASS}>Loading social drafts…</p>
      ) : messages.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="font-heading text-xl">No social messages yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Paste a DM or comment to watch a draft appear from the current knowledge base.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.4fr)]">
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-4 py-3 text-sm font-medium">Inbox</div>
            <div className="max-h-[70vh] overflow-y-auto">
              {messages.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedId(row.id)}
                  className={`block w-full border-b px-4 py-3 text-left last:border-b-0 ${
                    selected?.id === row.id ? "bg-muted/70" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">{row.fromName}</p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-1 truncate text-sm">
                    {SOCIAL_PLATFORM_LABEL[row.platform]} · {row.handle}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {selected ? (
            <div className="grid gap-4">
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{selected.fromName}</p>
                    <p className="text-xs text-muted-foreground">{selected.handle}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status={selected.status} />
                    <Badge variant="outline">{SOCIAL_PLATFORM_LABEL[selected.platform]}</Badge>
                    <Badge variant="outline">{INTENT_LABEL[selected.intent]}</Badge>
                  </div>
                </div>
                {selected.conversationUrl ? (
                  <p className="mt-2 truncate text-xs text-muted-foreground">
                    {selected.conversationUrl}
                  </p>
                ) : null}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{selected.body}</p>
              </div>
              <div className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-heading text-lg">Editable draft</h3>
                    <p className="text-sm text-muted-foreground">{selected.operatorNote}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selected.status === "posted" || selected.status === "discarded"}
                    onClick={() => void patch(selected.id, { regenerate: true })}
                  >
                    <RefreshCw className="size-4" />
                    Regenerate from knowledge
                  </Button>
                </div>
                <div className="mt-3">
                  <SourcePills sources={selected.sources ?? []} />
                </div>
                {selected.usedInternalKnowledge ? (
                  <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    This draft touched an internal document. Review before you post it.
                  </p>
                ) : null}
                <div className="mt-4">
                  <Field label="Reply">
                    <Textarea
                      value={selected.draftBody}
                      disabled={selected.status === "posted" || selected.status === "discarded"}
                      onChange={(e) => {
                        const draftBody = e.target.value;
                        setMessages((prev) =>
                          prev.map((row) =>
                            row.id === selected.id ? { ...row, draftBody } : row,
                          ),
                        );
                      }}
                      onBlur={() => void patch(selected.id, { draftBody: selected.draftBody })}
                      rows={12}
                    />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={async () => {
                      await navigator.clipboard.writeText(selected.draftBody);
                      toast.success("Draft copied — paste it in the social app yourself");
                    }}
                  >
                    <Copy className="size-4" />
                    Copy draft
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selected.status === "posted" || selected.status === "discarded"}
                    onClick={() => void patch(selected.id, { status: "posted" })}
                  >
                    Mark as posted
                  </Button>
                  <Button
                    variant="outline"
                    disabled={selected.status === "posted" || selected.status === "discarded"}
                    onClick={() => void patch(selected.id, { status: "escalated" })}
                  >
                    Keep with a human
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={selected.status === "posted" || selected.status === "discarded"}
                    onClick={() => void patch(selected.id, { status: "discarded" })}
                  >
                    Discard draft
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste a received social message</DialogTitle>
            <DialogDescription>
              BizPilot will write a draft from your knowledge. It still will not post.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Channel">
              <Select
                value={incoming.platform}
                onValueChange={(value) =>
                  setIncoming({ ...incoming, platform: value as SocialPlatform })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOCIAL_PLATFORMS.map((platform) => (
                    <SelectItem key={platform} value={platform}>
                      {SOCIAL_PLATFORM_LABEL[platform]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="From name">
              <Input
                value={incoming.fromName}
                onChange={(e) => setIncoming({ ...incoming, fromName: e.target.value })}
              />
            </Field>
            <Field label="Handle">
              <Input
                value={incoming.handle}
                onChange={(e) => setIncoming({ ...incoming, handle: e.target.value })}
                placeholder="@customer"
              />
            </Field>
            <Field label="Optional conversation link">
              <Input
                value={incoming.conversationUrl}
                onChange={(e) => setIncoming({ ...incoming, conversationUrl: e.target.value })}
              />
            </Field>
            <Field label="Message">
              <Textarea
                value={incoming.body}
                onChange={(e) => setIncoming({ ...incoming, body: e.target.value })}
                rows={5}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                if (!incoming.body.trim()) {
                  toast.error("Message is required");
                  return;
                }
                const response = await fetch("/api/app/social", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    platform: incoming.platform,
                    fromName: incoming.fromName || "Customer",
                    handle: incoming.handle || "@customer",
                    body: incoming.body,
                    conversationUrl: incoming.conversationUrl.trim() || undefined,
                  }),
                });
                const payload = (await response.json()) as {
                  message?: PaidSocialMessage;
                  error?: string;
                };
                if (!response.ok) {
                  toast.error(payload.error || "Could not create a draft");
                  return;
                }
                if (payload.message) {
                  setMessages((prev) => [payload.message!, ...prev]);
                  setSelectedId(payload.message.id);
                }
                setComposeOpen(false);
                setIncoming({
                  platform: "instagram",
                  fromName: "",
                  handle: "",
                  body: "",
                  conversationUrl: "",
                });
                toast.success("Draft created — copy and post it yourself");
              }}
            >
              Create draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: SocialStatus }) {
  const variant =
    status === "posted"
      ? "secondary"
      : status === "escalated" || status === "needs_review"
        ? "destructive"
        : status === "discarded"
          ? "outline"
          : "default";
  return <Badge variant={variant}>{SOCIAL_STATUS_LABEL[status]}</Badge>;
}
