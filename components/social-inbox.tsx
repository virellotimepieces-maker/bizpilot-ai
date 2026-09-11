"use client";

import { Field } from "@/components/field";
import { SetupGate } from "@/components/setup-gate";
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
import type { SocialMessage, SocialPlatform, SocialStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import { Copy, RefreshCw, Share2, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export function SocialInbox() {
  return (
    <SetupGate
      title="Social drafts, with humans in the loop"
      description="Paste an Instagram, Facebook, TikTok, or Messenger message. BizPilot writes a draft from the same knowledge as website chat and email. It never posts for you."
    >
      <InboxBody />
    </SetupGate>
  );
}

function InboxBody() {
  const {
    knowledge,
    socials,
    updateSocial,
    setSocialStatus,
    regenerateSocialDraft,
    simulateIncomingSocial,
  } = useWorkspace();
  const [selectedId, setSelectedId] = useState<string | null>(socials[0]?.id ?? null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [incoming, setIncoming] = useState({
    platform: "instagram" as SocialPlatform,
    fromName: "",
    handle: "",
    body: "",
    conversationUrl: "",
  });

  const selected = useMemo(
    () => socials.find((row) => row.id === selectedId) ?? socials[0] ?? null,
    [socials, selectedId],
  );

  if (!knowledge) return null;

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Social support
          </p>
          <h1 className={`${PAGE_TITLE_CLASS} mt-2`}>Drafts you post yourself</h1>
          <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS}`}>
            {knowledge.name} Instagram, Facebook, TikTok, and Messenger replies use the shared
            knowledge base. Copy the draft, post it in the app, then mark it posted here. There is
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
          Website chat may answer safe questions on its own. Social never auto-posts. Marking a
          draft as posted is a record that you copied it — nothing leaves this browser.
        </AlertDescription>
      </Alert>

      {socials.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="font-heading text-xl">No social messages yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Load a sample business on Overview, or paste a DM or comment to watch a draft appear
            from the current knowledge base.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.4fr)]">
          <div className="rounded-2xl border bg-card shadow-sm">
            <div className="border-b px-4 py-3 text-sm font-medium">Inbox</div>
            <div className="max-h-[70vh] overflow-y-auto">
              {socials.map((row) => (
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
                  <p className="mt-1 text-xs text-muted-foreground">{row.receivedAt}</p>
                </button>
              ))}
            </div>
          </div>

          {selected ? (
            <SocialDetail
              message={selected}
              onDraftChange={(draftBody) => updateSocial(selected.id, { draftBody })}
              onRegenerate={() => {
                regenerateSocialDraft(selected.id);
                toast.success("Draft regenerated from the current knowledge base");
              }}
              onCopy={async () => {
                await navigator.clipboard.writeText(selected.draftBody);
                toast.success("Draft copied — paste it in the social app yourself");
              }}
              onPosted={() => {
                setSocialStatus(selected.id, "posted");
                toast.success("Marked as posted by you");
              }}
              onEscalate={() => {
                setSocialStatus(selected.id, "escalated");
                toast.message("Kept in the human queue");
              }}
              onDiscard={() => {
                setSocialStatus(selected.id, "discarded");
                toast.message("Draft discarded");
              }}
            />
          ) : null}
        </div>
      )}

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Paste a received social message</DialogTitle>
            <DialogDescription>
              BizPilot will write a draft from the current knowledge base. It still will not post.
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
              onClick={() => {
                if (!incoming.body.trim()) {
                  toast.error("Message is required");
                  return;
                }
                simulateIncomingSocial({
                  platform: incoming.platform,
                  fromName: incoming.fromName || "Customer",
                  handle: incoming.handle || "@customer",
                  body: incoming.body,
                  conversationUrl: incoming.conversationUrl.trim() || undefined,
                });
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

function SocialDetail({
  message,
  onDraftChange,
  onRegenerate,
  onCopy,
  onPosted,
  onEscalate,
  onDiscard,
}: {
  message: SocialMessage;
  onDraftChange: (value: string) => void;
  onRegenerate: () => void;
  onCopy: () => void;
  onPosted: () => void;
  onEscalate: () => void;
  onDiscard: () => void;
}) {
  const locked = message.status === "posted" || message.status === "discarded";

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{message.fromName}</p>
            <p className="text-xs text-muted-foreground">{message.handle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={message.status} />
            <Badge variant="outline">{SOCIAL_PLATFORM_LABEL[message.platform]}</Badge>
            <Badge variant="outline">{INTENT_LABEL[message.intent]}</Badge>
          </div>
        </div>
        {message.conversationUrl ? (
          <p className="mt-2 truncate text-xs text-muted-foreground">{message.conversationUrl}</p>
        ) : null}
        <p className="mt-1 text-xs text-muted-foreground">{message.receivedAt}</p>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-heading text-lg">Editable draft</h3>
            <p className="text-sm text-muted-foreground">{message.operatorNote}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRegenerate} disabled={locked}>
            <RefreshCw className="size-4" />
            Regenerate from knowledge
          </Button>
        </div>
        <div className="mt-3">
          <SourcePills sources={message.sources} />
        </div>
        {message.usedInternalKnowledge ? (
          <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
            This draft touched an internal document. Website chat would not have auto-answered from
            that note. Review before you post it.
          </p>
        ) : null}
        <div className="mt-4">
          <Field label="Reply">
            <Textarea
              value={message.draftBody}
              disabled={locked}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={12}
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onCopy} disabled={!message.draftBody.trim()}>
            <Copy className="size-4" />
            Copy draft
          </Button>
          <Button variant="outline" onClick={onPosted} disabled={locked}>
            Mark as posted
          </Button>
          <Button variant="outline" onClick={onEscalate} disabled={locked}>
            Keep with a human
          </Button>
          <Button variant="ghost" onClick={onDiscard} disabled={locked}>
            Discard draft
          </Button>
        </div>
      </div>
    </div>
  );
}
