export const WIDGET_CHAT_API_PATH = "/api/widget/chat";
export const COPY_SNIPPET_FEEDBACK_MS = 2500;

export const WIDGET_PREVIEW_IFRAME_CLASS =
  "h-[min(70dvh,520px)] min-h-[420px] w-full max-w-full rounded-2xl border bg-white";

function normalizeOrigin(origin: string) {
  return origin.trim().replace(/\/$/, "");
}

export function widgetInstallSnippet(origin: string, widgetKey: string) {
  const base = normalizeOrigin(origin);
  if (!base || !widgetKey) {
    return "Subscribe and reload to get an install snippet. Set APP_URL so the snippet uses your public origin.";
  }
  return `<script src="${base}/w/${widgetKey}.js" async></script>`;
}

export function widgetPreviewEmbedUrl(origin: string, widgetKey: string) {
  const base = normalizeOrigin(origin);
  if (!base || !widgetKey) return "";
  return `${base}/embed/${encodeURIComponent(widgetKey)}`;
}

export function previewUsesCustomerWidget(origin: string, widgetKey: string) {
  const snippet = widgetInstallSnippet(origin, widgetKey);
  const preview = widgetPreviewEmbedUrl(origin, widgetKey);
  if (!preview || !snippet.startsWith("<script")) return false;
  const srcMatch = snippet.match(/src="([^"]+)"/);
  if (!srcMatch) return false;
  const scriptUrl = new URL(srcMatch[1]);
  const previewUrl = new URL(preview);
  return (
    scriptUrl.origin === previewUrl.origin &&
    scriptUrl.pathname === `/w/${widgetKey}.js` &&
    previewUrl.pathname === `/embed/${encodeURIComponent(widgetKey)}` &&
    !preview.includes("/demo") &&
    !preview.includes("/api/mock")
  );
}

export function copySnippetLabel(copied: boolean) {
  return copied ? "Copied" : "Copy snippet";
}

export function widgetPreviewButtonLabel() {
  return "Open widget preview";
}

export function widgetPreviewMissingOriginError() {
  return "The live preview needs APP_URL so it can load the same production widget a customer website uses.";
}

export function widgetPreviewMissingKeyError() {
  return "No website widget key is available for this workspace yet.";
}
