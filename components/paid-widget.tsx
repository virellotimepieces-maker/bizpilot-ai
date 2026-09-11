"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <CardTitle>Website widget</CardTitle>
        <CardDescription>
          One widget per BizPilot Pro workspace. Paste this on the business website. The widget
          talks to BizPilot’s servers, checks the subscription, and counts AI replies only after a
          successful answer.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4">
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
        {previewOpen ? (
          <div className="grid gap-2">
            <p className="text-sm text-muted-foreground">
              This is the live production widget for this workspace. Successful AI answers count
              toward the 500-reply monthly allowance.
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
      </CardContent>
    </Card>
  );
}
