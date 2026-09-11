"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COPY_SNIPPET_FEEDBACK_MS,
  copySnippetLabel,
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
  const [platform, setPlatform] = useState<WidgetPlatformId>("shopify");
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/app/bootstrap")
      .then((response) => response.json())
      .then((payload: { workspace?: { widgetKey: string }; appUrl?: string; error?: string }) => {
        if (cancelled) return;
        if (payload.error) {
          setPageState("error");
          setPageError(payload.error);
          return;
        }
        if (payload.workspace?.widgetKey) setWidgetKey(payload.workspace.widgetKey);
        if (payload.appUrl) setAppUrl(payload.appUrl);
        setPageState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setPageState("error");
        setPageError("Could not load the website widget.");
      });
    return () => {
      cancelled = true;
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const snippet = widgetInstallSnippet(appUrl, widgetKey);
  const previewUrl = widgetPreviewEmbedUrl(appUrl, widgetKey);
  const guide = getWidgetInstallGuide(platform);

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

  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader className="border-b">
        <CardTitle>Install widget</CardTitle>
        <CardDescription>
          One widget per BizPilot Pro workspace. Copy the unique snippet, follow the steps for your
          website, then confirm the chat launcher on the public site. Successful AI answers count
          toward the 500-reply monthly allowance.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 pt-4">
        {pageState === "loading" ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            Loading install snippet…
          </p>
        ) : null}
        {pageState === "error" || pageError ? (
          <p className="text-sm text-destructive" role="alert">
            {pageError}
          </p>
        ) : null}
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
              This is the live production widget for this workspace. Visitors see a round chat
              button first — tap it to open. Successful AI answers count toward the 500-reply
              monthly allowance.
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
          <Field label="Your website platform" hint="Pick the platform you actually use. The snippet is the same for every site.">
            <Select
              value={platform}
              onValueChange={(value) => setPlatform(value as WidgetPlatformId)}
            >
              <SelectTrigger className="h-10 w-full min-w-0">
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
            <h2 className="font-heading text-lg">Install on {guide.label}</h2>
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
            <h2 className="font-heading text-lg">Check that it worked</h2>
            <ol className="mt-3 grid list-decimal gap-2 pl-5">
              {WIDGET_VERIFY_STEPS.map((step) => (
                <li key={step} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div>
            <h2 className="font-heading text-lg">If something looks wrong</h2>
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
  );
}
