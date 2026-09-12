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
  SOCIAL_AI_HELPER_COPY,
  SOCIAL_CUSTOMER_FIELD_LABEL,
  SOCIAL_GOAL_LABEL,
  SOCIAL_GOALS,
  SOCIAL_HASHTAG_LABEL,
  SOCIAL_HASHTAG_MODES,
  SOCIAL_MODE_LABEL,
  SOCIAL_NEVER_POST,
  SOCIAL_PLATFORM_LABEL,
  SOCIAL_PLATFORMS,
  SOCIAL_STATUS_LABEL,
  SOCIAL_TONE_LABEL,
  SOCIAL_TONES,
  readSocialDraftMeta,
  socialListSubtitle,
  socialListTitle,
  type SocialHashtagMode,
  type SocialMode,
  type SocialPostGoal,
  type SocialTone,
} from "@/lib/social";
import {
  SOCIAL_ACTION_BUTTON_CLASS,
  SOCIAL_ACTION_ROW_CLASS,
  SOCIAL_CARD_CLASS,
  SOCIAL_CONTENT_BOX_CLASS,
  SOCIAL_FIELD_CONTROL_CLASS,
  SOCIAL_PAGE_TITLE_CLASS,
  SOCIAL_PANE_GRID_CLASS,
  SOCIAL_TOOLBAR_CLASS,
  SOCIAL_WRAP_INLINE_CLASS,
  SOCIAL_WRAP_TEXT_CLASS,
} from "@/lib/social-layout";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import type { SocialMessage, SocialPlatform, SocialStatus } from "@/lib/types";
import { useWorkspace } from "@/lib/workspace-store";
import { Copy, RefreshCw, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const emptyForm = {
  mode: "reply" as SocialMode,
  platform: "instagram" as SocialPlatform,
  fromName: "",
  body: "",
  conversationUrl: "",
  tone: "friendly" as SocialTone,
  goal: "awareness" as SocialPostGoal,
  hashtags: "none" as SocialHashtagMode,
  customHashtags: "",
  cta: "",
  link: "",
  language: "",
};

export function SocialInbox() {
  return (
    <SetupGate
      title="Social drafts, with humans in the loop"
      description={SOCIAL_AI_HELPER_COPY}
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
  const [form, setForm] = useState(emptyForm);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const selected = useMemo(
    () => socials.find((row) => row.id === selectedId) ?? socials[0] ?? null,
    [socials, selectedId],
  );

  if (!knowledge) return null;

  function generateDraft() {
    if (generating) return;
    if (!form.body.trim()) {
      const message =
        form.mode === "post" ? "Post instructions are required." : "Received message is required.";
      setGenerateError(message);
      toast.error(message);
      return;
    }
    setGenerating(true);
    setGenerateError("");
    try {
      simulateIncomingSocial({
        platform: form.platform,
        fromName: form.fromName.trim() || undefined,
        handle: form.fromName.trim() || undefined,
        body: form.body,
        conversationUrl:
          form.mode === "reply" ? form.conversationUrl.trim() || undefined : form.link.trim() || undefined,
        mode: form.mode,
        tone: form.tone,
        goal: form.mode === "post" ? form.goal : undefined,
        hashtags: form.mode === "post" ? form.hashtags : "none",
        customHashtags: form.mode === "post" && form.hashtags === "custom" ? form.customHashtags : undefined,
        cta: form.cta.trim() || undefined,
        link: form.link.trim() || undefined,
        language: form.language.trim() || undefined,
      });
      setDraftDirty(false);
      toast.success("Draft ready. Review and copy it — BizPilot never posts automatically.");
    } finally {
      setGenerating(false);
    }
  }

  const locked = selected?.status === "posted" || selected?.status === "discarded";
  const generateLabel = form.mode === "post" ? "Generate post" : "Generate reply";

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className={SOCIAL_CONTENT_BOX_CLASS}>
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Social drafts</p>
        <h1 className={SOCIAL_PAGE_TITLE_CLASS}>Drafts you post yourself</h1>
        <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS} ${SOCIAL_WRAP_TEXT_CLASS}`}>
          {SOCIAL_AI_HELPER_COPY}
        </p>
      </div>

      <Alert className={SOCIAL_CONTENT_BOX_CLASS}>
        <ShieldAlert />
        <AlertTitle>Draft only</AlertTitle>
        <AlertDescription className={SOCIAL_WRAP_INLINE_CLASS}>{SOCIAL_NEVER_POST}</AlertDescription>
      </Alert>

      <div className={SOCIAL_CARD_CLASS}>
        <div role="tablist" aria-label="Social draft mode" className={SOCIAL_TOOLBAR_CLASS}>
          {(["reply", "post"] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              role="tab"
              aria-selected={form.mode === mode}
              variant={form.mode === mode ? "default" : "outline"}
              className={SOCIAL_ACTION_BUTTON_CLASS}
              onClick={() => setForm((prev) => ({ ...prev, mode }))}
            >
              {SOCIAL_MODE_LABEL[mode]}
            </Button>
          ))}
        </div>
        <div className={`mt-4 grid gap-3 ${SOCIAL_CONTENT_BOX_CLASS}`}>
          <Field label="Platform" htmlFor="demo-social-platform">
            <Select
              value={form.platform}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, platform: value as SocialPlatform }))
              }
            >
              <SelectTrigger id="demo-social-platform" className={`w-full ${SOCIAL_FIELD_CONTROL_CLASS}`}>
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
          {form.mode === "reply" ? (
            <>
              <Field label={SOCIAL_CUSTOMER_FIELD_LABEL} htmlFor="demo-social-customer">
                <Input
                  id="demo-social-customer"
                  className={SOCIAL_FIELD_CONTROL_CLASS}
                  value={form.fromName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fromName: e.target.value }))}
                />
              </Field>
              <Field label="Conversation link (optional)" htmlFor="demo-social-link">
                <Input
                  id="demo-social-link"
                  className={SOCIAL_FIELD_CONTROL_CLASS}
                  value={form.conversationUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, conversationUrl: e.target.value }))}
                />
              </Field>
              <Field label="Received message" htmlFor="demo-social-received">
                <Textarea
                  id="demo-social-received"
                  className={`${SOCIAL_FIELD_CONTROL_CLASS} ${SOCIAL_WRAP_TEXT_CLASS} min-h-28`}
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={5}
                />
              </Field>
            </>
          ) : (
            <>
              <Field
                label="Topic, product, service, promotion, announcement, or post instructions"
                htmlFor="demo-social-instructions"
              >
                <Textarea
                  id="demo-social-instructions"
                  className={`${SOCIAL_FIELD_CONTROL_CLASS} ${SOCIAL_WRAP_TEXT_CLASS} min-h-28`}
                  value={form.body}
                  onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                  rows={5}
                />
              </Field>
              <Field label="Optional link" htmlFor="demo-social-post-link">
                <Input
                  id="demo-social-post-link"
                  className={SOCIAL_FIELD_CONTROL_CLASS}
                  value={form.link}
                  onChange={(e) => setForm((prev) => ({ ...prev, link: e.target.value }))}
                />
              </Field>
              <Field label="Goal" htmlFor="demo-social-goal">
                <Select
                  value={form.goal}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, goal: value as SocialPostGoal }))
                  }
                >
                  <SelectTrigger id="demo-social-goal" className={`w-full ${SOCIAL_FIELD_CONTROL_CLASS}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_GOALS.map((goal) => (
                      <SelectItem key={goal} value={goal}>
                        {SOCIAL_GOAL_LABEL[goal]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Hashtags" htmlFor="demo-social-hashtags">
                <Select
                  value={form.hashtags}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, hashtags: value as SocialHashtagMode }))
                  }
                >
                  <SelectTrigger id="demo-social-hashtags" className={`w-full ${SOCIAL_FIELD_CONTROL_CLASS}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_HASHTAG_MODES.map((mode) => (
                      <SelectItem key={mode} value={mode}>
                        {SOCIAL_HASHTAG_LABEL[mode]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
          <Field label={form.mode === "post" ? "Tone" : "Reply tone"} htmlFor="demo-social-tone">
            <Select
              value={form.tone}
              onValueChange={(value) => setForm((prev) => ({ ...prev, tone: value as SocialTone }))}
            >
              <SelectTrigger id="demo-social-tone" className={`w-full ${SOCIAL_FIELD_CONTROL_CLASS}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_TONES.map((tone) => (
                  <SelectItem key={tone} value={tone}>
                    {SOCIAL_TONE_LABEL[tone]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {generateError ? (
          <p className={`mt-3 text-sm text-destructive ${SOCIAL_WRAP_TEXT_CLASS}`} role="alert">
            {generateError}
          </p>
        ) : null}
        <div className={SOCIAL_ACTION_ROW_CLASS}>
          <Button
            className={SOCIAL_ACTION_BUTTON_CLASS}
            disabled={generating}
            aria-busy={generating}
            onClick={generateDraft}
          >
            {generating ? "Generating…" : generateLabel}
          </Button>
        </div>
      </div>

      {socials.length === 0 ? (
        <div className={`${SOCIAL_CARD_CLASS} text-center`}>
          <p className="font-heading text-xl">No social drafts yet</p>
          <p className={`mx-auto mt-2 max-w-md text-sm text-muted-foreground ${SOCIAL_WRAP_TEXT_CLASS}`}>
            Load a sample business on Overview, or generate a reply or post from the form above.
          </p>
        </div>
      ) : (
        <div className={SOCIAL_PANE_GRID_CLASS}>
          <div className={`${SOCIAL_CONTENT_BOX_CLASS} overflow-x-hidden rounded-2xl border bg-card shadow-sm`}>
            <div className="border-b px-4 py-3 text-sm font-medium">Inbox</div>
            <div className="max-h-[70vh] overflow-y-auto">
              {socials.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(row.id);
                    setDraftDirty(false);
                  }}
                  className={`block w-full min-w-0 border-b px-4 py-3 text-left last:border-b-0 ${
                    selected?.id === row.id ? "bg-muted/70" : "hover:bg-muted/40"
                  }`}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className={`truncate text-sm font-medium ${SOCIAL_WRAP_INLINE_CLASS}`}>
                      {socialListTitle(row)}
                    </p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className={`mt-1 truncate text-sm ${SOCIAL_WRAP_INLINE_CLASS}`}>
                    {socialListSubtitle(row)}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {selected ? (
            <SocialDetail
              message={selected}
              generating={generating}
              locked={Boolean(locked)}
              onDraftChange={(draftBody) => {
                setDraftDirty(true);
                updateSocial(selected.id, { draftBody });
              }}
              onRegenerate={() => {
                if (draftDirty) {
                  setConfirmRegenerate(true);
                  return;
                }
                regenerateSocialDraft(selected.id);
                setDraftDirty(false);
                toast.success("Draft regenerated. Nothing was posted.");
              }}
              onCopy={async () => {
                await navigator.clipboard.writeText(selected.draftBody);
                toast.success("Draft copied — paste it in the social app yourself");
              }}
              onPosted={() => {
                setSocialStatus(selected.id, "posted");
                toast.success("Marked as posted by you. BizPilot did not post it.");
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

      <Dialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Replace your edited draft?</DialogTitle>
            <DialogDescription className={SOCIAL_WRAP_INLINE_CLASS}>
              Regenerating replaces the suggested draft. Your manual edits will be lost. Nothing will
              be posted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className={SOCIAL_ACTION_BUTTON_CLASS} onClick={() => setConfirmRegenerate(false)}>
              Keep edits
            </Button>
            <Button
              className={SOCIAL_ACTION_BUTTON_CLASS}
              onClick={() => {
                setConfirmRegenerate(false);
                if (selected) {
                  regenerateSocialDraft(selected.id);
                  setDraftDirty(false);
                  toast.success("Draft regenerated. Nothing was posted.");
                }
              }}
            >
              Regenerate
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
  generating,
  locked,
  onDraftChange,
  onRegenerate,
  onCopy,
  onPosted,
  onEscalate,
  onDiscard,
}: {
  message: SocialMessage;
  generating: boolean;
  locked: boolean;
  onDraftChange: (value: string) => void;
  onRegenerate: () => void;
  onCopy: () => void;
  onPosted: () => void;
  onEscalate: () => void;
  onDiscard: () => void;
}) {
  const meta = readSocialDraftMeta(message.handle);
  return (
    <div className={`grid gap-4 ${SOCIAL_CONTENT_BOX_CLASS}`}>
      <div className={SOCIAL_CARD_CLASS}>
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 max-w-full">
            <p className={`text-sm font-medium ${SOCIAL_WRAP_INLINE_CLASS}`}>{socialListTitle(message)}</p>
            <p className={`text-xs text-muted-foreground ${SOCIAL_WRAP_INLINE_CLASS}`}>
              {meta.displayHandle || (meta.mode === "post" ? "Create post" : "")}
            </p>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            <StatusBadge status={message.status} />
            <Badge variant="outline">{SOCIAL_PLATFORM_LABEL[message.platform]}</Badge>
            <Badge variant="outline">{INTENT_LABEL[message.intent]}</Badge>
          </div>
        </div>
        {message.conversationUrl ? (
          <p className={`mt-2 text-xs text-muted-foreground ${SOCIAL_WRAP_INLINE_CLASS}`}>
            {message.conversationUrl}
          </p>
        ) : null}
        <p className={`mt-4 text-sm leading-relaxed ${SOCIAL_WRAP_TEXT_CLASS}`}>{message.body}</p>
      </div>
      <div className={SOCIAL_CARD_CLASS}>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-heading text-base sm:text-lg">Editable draft</h3>
            <p className={`text-sm text-muted-foreground ${SOCIAL_WRAP_INLINE_CLASS}`}>{message.operatorNote}</p>
          </div>
          <Button
            variant="outline"
            className={SOCIAL_ACTION_BUTTON_CLASS}
            onClick={onRegenerate}
            disabled={locked || generating}
          >
            <RefreshCw className="size-4" />
            Regenerate
          </Button>
        </div>
        <div className={`mt-3 ${SOCIAL_CONTENT_BOX_CLASS}`}>
          <SourcePills sources={message.sources} hideEmpty />
        </div>
        <div className={`mt-4 ${SOCIAL_CONTENT_BOX_CLASS}`}>
          <Field label="Draft" htmlFor="demo-social-draft">
            <Textarea
              id="demo-social-draft"
              className={`${SOCIAL_FIELD_CONTROL_CLASS} ${SOCIAL_WRAP_TEXT_CLASS} min-h-40`}
              value={message.draftBody}
              disabled={locked}
              onChange={(e) => onDraftChange(e.target.value)}
              rows={12}
            />
          </Field>
        </div>
        <div className={SOCIAL_ACTION_ROW_CLASS}>
          <Button className={SOCIAL_ACTION_BUTTON_CLASS} onClick={onCopy} disabled={!message.draftBody.trim()}>
            <Copy className="size-4" />
            Copy draft
          </Button>
          <Button variant="outline" className={SOCIAL_ACTION_BUTTON_CLASS} onClick={onPosted} disabled={locked}>
            Mark as posted
          </Button>
          <Button variant="outline" className={SOCIAL_ACTION_BUTTON_CLASS} onClick={onEscalate} disabled={locked}>
            Keep with a human
          </Button>
          <Button variant="ghost" className={SOCIAL_ACTION_BUTTON_CLASS} onClick={onDiscard} disabled={locked}>
            Discard draft
          </Button>
        </div>
      </div>
    </div>
  );
}
