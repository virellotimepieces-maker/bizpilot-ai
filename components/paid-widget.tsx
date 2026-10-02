"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  appearanceDraftFromSettings,
  WidgetAppearanceForm,
  type AppearanceDraft,
} from "@/components/widget-appearance-form";
import {
  COPY_SNIPPET_FEEDBACK_MS,
  copySnippetLabel,
  WIDGET_APP_SETTINGS_PATH,
  widgetInstallSnippet,
  widgetPreviewButtonLabel,
  widgetPreviewEmbedUrl,
  widgetPreviewMissingKeyError,
  widgetPreviewMissingOriginError,
  WIDGET_PREVIEW_IFRAME_CLASS,
} from "@/lib/widget-preview";
import {
  getWidgetInstallGuide,
  WIDGET_INSTALL_GUIDE_LAYOUT_CLASS,
  WIDGET_PLATFORMS,
  WIDGET_SECRET_WARNING,
  WIDGET_TROUBLESHOOTING,
  WIDGET_VERIFY_STEPS,
  type WidgetPlatformId,
} from "@/lib/widget-install-guides";
import {
  HELPER_TEXT_CLASS,
  PAGE_SHELL_CLASS,
  SECTION_HEADING_CLASS,
  TAB_ITEM_CLASS,
  TAB_ROW_CLASS,
} from "@/lib/ui/type-scale";
import {
  getKnowledgeSaveView,
  KNOWLEDGE_SAVED_VISIBLE_MS,
  shouldStartKnowledgeSave,
} from "@/lib/knowledge-save-state";
import type { SerializedWidgetSettings } from "@/lib/v2/widget-settings";
import { useEffect, useRef, useState } from "react";

export function PaidWidget() {
  const [widgetKey, setWidgetKey] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [pageState, setPageState] = useState<"loading" | "ready" | "error">("loading");
  const [pageError, setPageError] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [previewNonce, setPreviewNonce] = useState(0);
  const [platform, setPlatform] = useState<WidgetPlatformId>("shopify");
  const [draft, setDraft] = useState<AppearanceDraft | null>(null);
  const [persisted, setPersisted] = useState<AppearanceDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [bootstrapResponse, settingsResponse] = await Promise.all([
          fetch("/api/app/bootstrap"),
          fetch(WIDGET_APP_SETTINGS_PATH),
        ]);
        const bootstrap = (await bootstrapResponse.json()) as {
          workspace?: { widgetKey: string };
          appUrl?: string;
          error?: string;
        };
        const settingsPayload = (await settingsResponse.json()) as {
          settings?: SerializedWidgetSettings;
          error?: string;
        };
        if (cancelled) return;
        if (bootstrap.error) {
          setPageState("error");
          setPageError(bootstrap.error);
          return;
        }
        if (settingsPayload.error && !settingsPayload.settings) {
          setPageState("error");
          setPageError(settingsPayload.error);
          return;
        }
        if (bootstrap.workspace?.widgetKey) setWidgetKey(bootstrap.workspace.widgetKey);
        if (bootstrap.appUrl) setAppUrl(bootstrap.appUrl);
        if (settingsPayload.settings) {
          const next = appearanceDraftFromSettings(settingsPayload.settings);
          setDraft(next);
          setPersisted(next);
        }
        setPageState("ready");
      } catch {
        if (cancelled) return;
        setPageState("error");
        setPageError("Could not load the website widget.");
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const snippet = widgetInstallSnippet(appUrl, widgetKey);
  const previewUrl = widgetPreviewEmbedUrl(appUrl, widgetKey);
  const guide = getWidgetInstallGuide(platform);
  const dirty = Boolean(draft && persisted && JSON.stringify(draft) !== JSON.stringify(persisted));
  const saveView = getKnowledgeSaveView({
    dirty,
    saving,
    justSaved,
    error: saveError,
  });

  async function copySnippet() {
    if (!widgetKey) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), COPY_SNIPPET_FEEDBACK_MS);
    } catch {
      setPageError("Could not copy the snippet.");
    }
  }

  function openPreview() {
    setPreviewError("");
    if (!widgetKey) {
      setPreviewError(widgetPreviewMissingKeyError());
      setPreviewOpen(true);
      return;
    }
    if (!previewUrl) {
      setPreviewError(widgetPreviewMissingOriginError());
      setPreviewOpen(true);
      return;
    }
    setPreviewOpen(true);
    setPreviewLoading(true);
  }

  async function saveAppearance() {
    if (!draft || !shouldStartKnowledgeSave({ dirty, saving }) || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setSaveError(null);
    setJustSaved(false);
    try {
      const response = await fetch(WIDGET_APP_SETTINGS_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          suggestedQuestions: draft.suggestedQuestions.map((row) => row.trim()).filter(Boolean),
        }),
      });
      const payload = (await response.json()) as {
        settings?: SerializedWidgetSettings;
        error?: string;
      };
      if (!response.ok || !payload.settings) {
        setSaveError(payload.error || "Could not save widget appearance.");
        return;
      }
      const next = appearanceDraftFromSettings(payload.settings);
      setDraft(next);
      setPersisted(next);
      setJustSaved(true);
      setPreviewNonce((value) => value + 1);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setJustSaved(false), KNOWLEDGE_SAVED_VISIBLE_MS);
    } catch {
      setSaveError("Could not save widget appearance.");
    } finally {
      setSaving(false);
      inFlight.current = false;
    }
  }

  if (pageState === "loading" && !draft) {
    return (
      <div className={PAGE_SHELL_CLASS} aria-busy="true" aria-label="Loading widget">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <div className={PAGE_SHELL_CLASS}>
      <PageHeader
        eyebrow="Website"
        title="Website widget"
        description="Set how the live chat looks on your site, then paste the unique snippet. Successful AI answers count toward the 500-reply monthly allowance."
      />
      {pageState === "error" || pageError ? (
        <p className="text-sm text-destructive" role="alert">
          {pageError}
        </p>
      ) : null}
      <Tabs defaultValue="appearance" className="min-w-0">
        <TabsList variant="line" className={`${TAB_ROW_CLASS} w-full max-w-full justify-start`}>
          <TabsTrigger value="appearance" className={TAB_ITEM_CLASS}>
            Appearance
          </TabsTrigger>
          <TabsTrigger value="install" className={TAB_ITEM_CLASS}>
            Install
          </TabsTrigger>
        </TabsList>
        <TabsContent value="appearance" className="min-w-0 pt-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Chat appearance</CardTitle>
              <CardDescription>
                Welcome copy, suggested questions, indigo accent, and launcher corner. Save before
                you check the live preview.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              {draft ? (
                <WidgetAppearanceForm
                  draft={draft}
                  onChange={(next) => {
                    setDraft(next);
                    if (justSaved) setJustSaved(false);
                    if (saveError) setSaveError(null);
                  }}
                  onSave={() => void saveAppearance()}
                  saving={saving}
                  saveLabel={saveView.label}
                  disabled={saveView.disabled || pageState !== "ready"}
                  error={saveView.error}
                />
              ) : (
                <p className={HELPER_TEXT_CLASS}>Loading appearance…</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="install" className="min-w-0 pt-4">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Install widget</CardTitle>
              <CardDescription>
                One widget per BizPilot Pro workspace. Copy the unique snippet, follow the steps
                for your website, then confirm the chat launcher on the public site. Successful AI
                answers count toward the 500-reply monthly allowance.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5 pt-4">
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs break-all whitespace-pre-wrap sm:whitespace-pre">
                {snippet}
              </pre>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  variant="outline"
                  className="w-full sm:w-fit"
                  onClick={() => void copySnippet()}
                  disabled={!widgetKey || pageState !== "ready"}
                  aria-live="polite"
                >
                  {copySnippetLabel(copied)}
                </Button>
                <Button
                  className="w-full sm:w-fit"
                  onClick={openPreview}
                  disabled={pageState !== "ready"}
                >
                  {widgetPreviewButtonLabel()}
                </Button>
              </div>
              <p className="rounded-xl border bg-muted/40 px-3 py-3 text-sm leading-relaxed">
                {WIDGET_SECRET_WARNING}
              </p>
              {previewOpen ? (
                <div className="grid gap-2">
                  <p className="text-sm text-muted-foreground">
                    This is the live production widget for this workspace. Successful AI answers
                    count toward the 500-reply monthly allowance. Reload after saving Appearance
                    so the preview picks up the new look.
                  </p>
                  {previewLoading ? (
                    <p className="text-sm text-muted-foreground" aria-live="polite">
                      Loading live widget…
                    </p>
                  ) : null}
                  {previewError ? (
                    <p className="text-sm text-destructive" role="alert">
                      {previewError}
                    </p>
                  ) : null}
                  {previewUrl && !previewError ? (
                    <iframe
                      key={previewNonce}
                      title="BizPilot live widget preview"
                      src={previewUrl}
                      className={WIDGET_PREVIEW_IFRAME_CLASS}
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => {
                        setPreviewLoading(false);
                        setPreviewError("The live widget preview failed to load.");
                      }}
                    />
                  ) : null}
                </div>
              ) : null}

              <div className={WIDGET_INSTALL_GUIDE_LAYOUT_CLASS}>
                <Field
                  label="Your website platform"
                  hint="Pick the platform you actually use. The snippet is the same for every site."
                >
                  <Select
                    value={platform}
                    onValueChange={(value) => setPlatform(value as WidgetPlatformId)}
                  >
                    <SelectTrigger className="h-11 min-h-11 w-full min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WIDGET_PLATFORMS.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <div>
                  <h2 className={SECTION_HEADING_CLASS}>Install on {guide.label}</h2>
                  <ol className="mt-3 grid list-decimal gap-2 pl-5">
                    {guide.steps.map((step) => (
                      <li key={step} className="pl-1">
                        {step}
                      </li>
                    ))}
                  </ol>
                  <p className="mt-3">
                    <span className="font-medium">Where to paste: </span>
                    {guide.pasteWhere}
                  </p>
                  <p>
                    <span className="font-medium">How to publish: </span>
                    {guide.publishHow}
                  </p>
                </div>

                <div>
                  <h2 className={SECTION_HEADING_CLASS}>Check that it worked</h2>
                  <ol className="mt-3 grid list-decimal gap-2 pl-5">
                    {WIDGET_VERIFY_STEPS.map((step) => (
                      <li key={step} className="pl-1">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <h2 className={SECTION_HEADING_CLASS}>If something looks wrong</h2>
                  <div className="mt-3 grid gap-3">
                    {WIDGET_TROUBLESHOOTING.map((item) => (
                      <div key={item.id} className="rounded-xl border px-3 py-3">
                        <p className="font-medium">{item.title}</p>
                        <p className="mt-1 text-muted-foreground">{item.body}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
