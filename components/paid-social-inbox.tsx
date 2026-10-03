"use client";

import { Field } from "@/components/field";
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
import {
  SOCIAL_AI_HELPER_COPY,
  SOCIAL_CONTENT_GOALS,
  SOCIAL_CONTENT_PLATFORMS,
  SOCIAL_GOAL_LABEL,
  SOCIAL_NEVER_POST,
  SOCIAL_PLATFORM_LABEL,
  readSocialDraftMeta,
} from "@/lib/social";
import {
  SOCIAL_CONTENT_LANGUAGES,
  socialLanguageLabel,
  socialPublishBlockedReason,
  type SocialContentLanguage,
} from "@/lib/social-content";
import {
  SOCIAL_ACTION_BUTTON_CLASS,
  SOCIAL_ACTION_ROW_CLASS,
  SOCIAL_CARD_CLASS,
  SOCIAL_CONTENT_BOX_CLASS,
  SOCIAL_FIELD_CONTROL_CLASS,
  SOCIAL_PAGE_TITLE_CLASS,
  SOCIAL_PANE_GRID_CLASS,
  SOCIAL_WRAP_INLINE_CLASS,
  SOCIAL_WRAP_TEXT_CLASS,
} from "@/lib/social-layout";
import { HELPER_TEXT_CLASS, PAGE_SHELL_CLASS } from "@/lib/ui/type-scale";
import type { SocialPlatform, SocialStatus } from "@/lib/types";
import type { SocialPostGoal } from "@/lib/ai/social-prompt";
import { Copy, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type PaidSocialMessage = {
  id: string;
  platform: SocialPlatform;
  fromName: string;
  handle: string;
  body: string;
  status: SocialStatus;
  workflow: "Draft" | "Approved" | "Published" | "Failed";
  language: string;
  goal: string;
  draftBody: string;
  operatorNote: string;
  createdAt: string;
  publishAvailable: boolean;
};

const emptyForm = {
  platform: "instagram" as SocialPlatform,
  goal: "promote_product" as SocialPostGoal,
  instruction: "",
  language: "auto" as SocialContentLanguage,
  otherLanguage: "",
};

export function PaidSocialInbox() {
  const [messages, setMessages] = useState<PaidSocialMessage[]>([]);
  const [publishReason, setPublishReason] = useState(socialPublishBlockedReason());
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [draftDirty, setDraftDirty] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/app/social", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as {
          messages?: PaidSocialMessage[];
          publishing?: { reason?: string };
          error?: string;
        };
        return { ok: response.ok, payload };
      })
      .then(({ ok, payload }) => {
        if (!ok) {
          setError(payload.error || "Could not load social drafts.");
          setLoading(false);
          return;
        }
        setError("");
        setMessages(payload.messages ?? []);
        if (payload.publishing?.reason) setPublishReason(payload.publishing.reason);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError("Could not load social drafts.");
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

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
    if (body.regenerate) {
      setDraftDirty(false);
      toast.success("Draft regenerated. Nothing was posted.");
    }
    if (body.status === "approved") toast.success("Draft marked approved. Nothing was published.");
    if (body.draftBody !== undefined && !body.regenerate) toast.success("Draft saved.");
  }

  async function generateDraft() {
    if (generating) return;
    setGenerating(true);
    setGenerateError("");
    try {
      const response = await fetch("/api/app/social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "post",
          platform: form.platform,
          goal: form.goal,
          instruction: form.instruction,
          body: form.instruction,
          language: form.language,
          otherLanguage: form.language === "other" ? form.otherLanguage : undefined,
          hashtags: "suggested",
        }),
      });
      const payload = (await response.json()) as { message?: PaidSocialMessage; error?: string };
      if (!response.ok) {
        const message = payload.error || "Could not create a draft";
        setGenerateError(message);
        toast.error(message);
        return;
      }
      if (payload.message) {
        setMessages((prev) => [payload.message!, ...prev]);
        setSelectedId(payload.message.id);
        setDraftDirty(false);
        toast.success("Draft ready. Review it before you copy it. Nothing was published.");
      }
    } catch {
      setGenerateError("Could not create a draft. Try again.");
      toast.error("Could not create a draft. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function deleteDraft(id: string) {
    const response = await fetch("/api/app/social", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(payload.error || "Could not delete the draft");
      return;
    }
    setMessages((prev) => prev.filter((row) => row.id !== id));
    setSelectedId(null);
    setDraftDirty(false);
    toast.success("Draft deleted.");
  }

  function requestRegenerate() {
    if (!selected || generating) return;
    if (draftDirty) {
      setConfirmRegenerate(true);
      return;
    }
    void patch(selected.id, { regenerate: true });
  }

  if (error && !messages.length && !loading) {
    return (
      <p className={`text-sm text-destructive md:text-base ${SOCIAL_WRAP_TEXT_CLASS}`} role="alert">
        {error}
      </p>
    );
  }

  const locked = selected?.workflow === "Published" || selected?.workflow === "Failed";

  return (
    <div className={PAGE_SHELL_CLASS}>
      <div className={SOCIAL_CONTENT_BOX_CLASS}>
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">Social</p>
        <h1 className={SOCIAL_PAGE_TITLE_CLASS}>Social content and drafts</h1>
        <p className={`mt-2 max-w-2xl ${HELPER_TEXT_CLASS} ${SOCIAL_WRAP_TEXT_CLASS}`}>{SOCIAL_AI_HELPER_COPY}</p>
      </div>

      <Alert className={SOCIAL_CONTENT_BOX_CLASS}>
        <ShieldAlert />
        <AlertTitle>Draft only</AlertTitle>
        <AlertDescription className={SOCIAL_WRAP_INLINE_CLASS}>{SOCIAL_NEVER_POST}</AlertDescription>
      </Alert>

      <div className={SOCIAL_CARD_CLASS}>
        <div className={`grid gap-3 ${SOCIAL_CONTENT_BOX_CLASS}`}>
          <Field label="Platform" htmlFor="social-platform">
            <Select
              value={form.platform}
              onValueChange={(value) => setForm((prev) => ({ ...prev, platform: value as SocialPlatform }))}
            >
              <SelectTrigger id="social-platform" className={`w-full ${SOCIAL_FIELD_CONTROL_CLASS}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_CONTENT_PLATFORMS.map((platform) => (
                  <SelectItem key={platform} value={platform}>
                    {SOCIAL_PLATFORM_LABEL[platform]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Content goal" htmlFor="social-goal">
            <Select
              value={form.goal}
              onValueChange={(value) => setForm((prev) => ({ ...prev, goal: value as SocialPostGoal }))}
            >
              <SelectTrigger id="social-goal" className={`w-full ${SOCIAL_FIELD_CONTROL_CLASS}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_CONTENT_GOALS.map((goal) => (
                  <SelectItem key={goal} value={goal}>
                    {SOCIAL_GOAL_LABEL[goal]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Instruction or topic (optional)" htmlFor="social-instruction">
            <Textarea
              id="social-instruction"
              className={`${SOCIAL_FIELD_CONTROL_CLASS} ${SOCIAL_WRAP_TEXT_CLASS} min-h-28`}
              value={form.instruction}
              onChange={(event) => setForm((prev) => ({ ...prev, instruction: event.target.value }))}
              rows={5}
            />
          </Field>
          <Field label="Language" htmlFor="social-language">
            <Select
              value={form.language}
              onValueChange={(value) =>
                setForm((prev) => ({ ...prev, language: value as SocialContentLanguage }))
              }
            >
              <SelectTrigger id="social-language" className={`w-full ${SOCIAL_FIELD_CONTROL_CLASS}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOCIAL_CONTENT_LANGUAGES.map(([code, label]) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {form.language === "other" ? (
            <Field label="Other language" htmlFor="social-other-language">
              <Input
                id="social-other-language"
                className={SOCIAL_FIELD_CONTROL_CLASS}
                value={form.otherLanguage}
                onChange={(event) => setForm((prev) => ({ ...prev, otherLanguage: event.target.value }))}
              />
            </Field>
          ) : null}
        </div>
        {generateError ? (
          <p className={`mt-3 text-sm text-destructive ${SOCIAL_WRAP_TEXT_CLASS}`} role="alert">
            {generateError}
          </p>
        ) : null}
        {generating ? (
          <p className={`mt-3 ${HELPER_TEXT_CLASS}`} aria-live="polite">
            Generating draft…
          </p>
        ) : null}
        <div className={SOCIAL_ACTION_ROW_CLASS}>
          <Button
            className={SOCIAL_ACTION_BUTTON_CLASS}
            disabled={generating}
            aria-busy={generating}
            onClick={() => void generateDraft()}
          >
            {generating ? "Generating…" : "Generate"}
          </Button>
        </div>
      </div>

      {loading ? (
        <p className={HELPER_TEXT_CLASS}>Loading social drafts…</p>
      ) : messages.length === 0 ? (
        <div className={`${SOCIAL_CARD_CLASS} text-center`}>
          <p className="font-heading text-xl">No social drafts yet</p>
          <p className={`mx-auto mt-2 max-w-md text-sm text-muted-foreground ${SOCIAL_WRAP_TEXT_CLASS}`}>
            Generate a draft from this workspace’s knowledge. It stays a draft until you copy it yourself.
          </p>
        </div>
      ) : (
        <div className={SOCIAL_PANE_GRID_CLASS}>
          <div className={`${SOCIAL_CONTENT_BOX_CLASS} overflow-x-hidden rounded-2xl border bg-card shadow-sm`}>
            <div className="border-b px-4 py-3 text-sm font-medium">Drafts</div>
            <div className="max-h-[70vh] overflow-y-auto">
              {messages.map((row) => (
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
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <p className={`text-sm font-medium ${SOCIAL_WRAP_INLINE_CLASS}`}>
                      {SOCIAL_PLATFORM_LABEL[row.platform] ?? row.platform}
                    </p>
                    <StatusBadge workflow={row.workflow} />
                  </div>
                  <p className={`mt-1 text-sm ${SOCIAL_WRAP_TEXT_CLASS}`}>
                    {(row.draftBody || row.body).replace(/\s+/g, " ").slice(0, 90)}
                  </p>
                  <p className={`mt-1 text-xs text-muted-foreground ${SOCIAL_WRAP_INLINE_CLASS}`}>
                    {socialLanguageLabel(readSocialDraftMeta(row.handle).language || row.language)} ·{" "}
                    {new Date(row.createdAt).toLocaleDateString()}
                  </p>
                </button>
              ))}
            </div>
          </div>
          {selected ? (
            <div className={SOCIAL_CARD_CLASS}>
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-heading text-base sm:text-lg">Editable draft</h2>
                  <p className={`text-sm text-muted-foreground ${SOCIAL_WRAP_INLINE_CLASS}`}>{selected.operatorNote}</p>
                </div>
                <StatusBadge workflow={selected.workflow} />
              </div>
              <Field label="Draft" htmlFor="social-draft-body">
                <Textarea
                  id="social-draft-body"
                  className={`${SOCIAL_FIELD_CONTROL_CLASS} ${SOCIAL_WRAP_TEXT_CLASS} mt-3 min-h-40`}
                  value={selected.draftBody}
                  disabled={locked}
                  onChange={(event) => {
                    const draftBody = event.target.value;
                    setDraftDirty(true);
                    setMessages((prev) =>
                      prev.map((row) => (row.id === selected.id ? { ...row, draftBody } : row)),
                    );
                  }}
                  rows={12}
                />
              </Field>
              <div className={SOCIAL_ACTION_ROW_CLASS}>
                <Button
                  className={SOCIAL_ACTION_BUTTON_CLASS}
                  disabled={locked || !selected.draftBody.trim()}
                  onClick={() => void patch(selected.id, { draftBody: selected.draftBody, status: "draft" })}
                >
                  Save draft
                </Button>
                <Button
                  variant="outline"
                  className={SOCIAL_ACTION_BUTTON_CLASS}
                  disabled={!selected.draftBody.trim()}
                  onClick={async () => {
                    await navigator.clipboard.writeText(selected.draftBody);
                    toast.success("Draft copied. Paste it yourself. Nothing was published.");
                  }}
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  className={SOCIAL_ACTION_BUTTON_CLASS}
                  disabled={locked || generating}
                  onClick={requestRegenerate}
                >
                  <RefreshCw className="size-4" />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  className={SOCIAL_ACTION_BUTTON_CLASS}
                  disabled={locked || selected.workflow === "Approved"}
                  onClick={() => void patch(selected.id, { status: "approved" })}
                >
                  Mark approved
                </Button>
                <Button
                  variant="outline"
                  className={SOCIAL_ACTION_BUTTON_CLASS}
                  disabled
                  title={publishReason}
                >
                  Publish
                </Button>
                <Button
                  variant="ghost"
                  className={SOCIAL_ACTION_BUTTON_CLASS}
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              </div>
              <p className={`mt-3 text-sm text-muted-foreground ${SOCIAL_WRAP_TEXT_CLASS}`}>{publishReason}</p>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={confirmRegenerate} onOpenChange={setConfirmRegenerate}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Replace your edited draft?</DialogTitle>
            <DialogDescription className={SOCIAL_WRAP_INLINE_CLASS}>
              Regenerating replaces the suggested draft. Your manual edits will be lost. Nothing will be posted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className={SOCIAL_ACTION_BUTTON_CLASS}
              onClick={() => setConfirmRegenerate(false)}
            >
              Keep edits
            </Button>
            <Button
              className={SOCIAL_ACTION_BUTTON_CLASS}
              onClick={() => {
                setConfirmRegenerate(false);
                if (selected) void patch(selected.id, { regenerate: true });
              }}
            >
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete this draft?</DialogTitle>
            <DialogDescription className={SOCIAL_WRAP_INLINE_CLASS}>
              This removes the draft from this workspace. It does not publish or delete anything on a social network.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className={SOCIAL_ACTION_BUTTON_CLASS} onClick={() => setConfirmDelete(false)}>
              Keep draft
            </Button>
            <Button
              className={SOCIAL_ACTION_BUTTON_CLASS}
              onClick={() => {
                setConfirmDelete(false);
                if (selected) void deleteDraft(selected.id);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ workflow }: { workflow: PaidSocialMessage["workflow"] }) {
  const variant =
    workflow === "Failed" ? "destructive" : workflow === "Approved" || workflow === "Published" ? "secondary" : "default";
  return <Badge variant={variant}>{workflow}</Badge>;
}
