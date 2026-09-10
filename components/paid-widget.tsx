"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useState } from "react";

export function PaidWidget() {
  const [widgetKey, setWidgetKey] = useState("");
  const [appUrl, setAppUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/app/bootstrap")
      .then((response) => response.json())
      .then((payload: { workspace?: { widgetKey: string }; appUrl?: string }) => {
        if (cancelled) return;
        if (payload.workspace?.widgetKey) setWidgetKey(payload.workspace.widgetKey);
        if (payload.appUrl) setAppUrl(payload.appUrl);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const origin = appUrl;
  const snippet = widgetKey
    ? `<script src="${origin}/w/${widgetKey}.js" async></script>`
    : "Subscribe and reload to get an install snippet. Set APP_URL so the snippet uses your public origin.";

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
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{snippet}</pre>
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => void navigator.clipboard.writeText(snippet)}
          disabled={!widgetKey}
        >
          Copy snippet
        </Button>
      </CardContent>
    </Card>
  );
}
