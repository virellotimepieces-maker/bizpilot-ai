export const WIDGET_IFRAME_ID = "bizpilot-widget";
export const WIDGET_POST_MESSAGE_SOURCE = "bizpilot-widget";
export const WIDGET_MAX_WIDTH = "calc(100vw - 24px)";
export const WIDGET_MAX_HEIGHT = "calc(100dvh - 120px)";
export const WIDGET_LAUNCHER_SIZE_PX = 56;
export const WIDGET_DESKTOP_WIDTH_PX = 360;
export const WIDGET_DESKTOP_HEIGHT_PX = 520;
export const WIDGET_MOBILE_MEDIA = "(max-width: 640px)";
export const WIDGET_EDGE_OFFSET = "12px";

export type WidgetHostMessageType = "open" | "close";

export type WidgetHostMessage = {
  source: typeof WIDGET_POST_MESSAGE_SOURCE;
  type: WidgetHostMessageType;
};

export function widgetEmbedPath(widgetKey: string) {
  return `/embed/${encodeURIComponent(widgetKey)}`;
}

export function widgetScriptPath(widgetKey: string) {
  return `/w/${widgetKey}.js`;
}

export function isWidgetHostMessage(data: unknown): data is WidgetHostMessage {
  if (!data || typeof data !== "object") return false;
  const message = data as { source?: unknown; type?: unknown };
  return (
    message.source === WIDGET_POST_MESSAGE_SOURCE &&
    (message.type === "open" || message.type === "close")
  );
}

export function buildWidgetHostMessage(type: WidgetHostMessageType): WidgetHostMessage {
  return { source: WIDGET_POST_MESSAGE_SOURCE, type };
}

export function widgetScriptOrigin(request: {
  url: string;
  headers: { get(name: string): string | null };
  nextUrl?: { protocol?: string };
}) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? request.headers.get("host") ?? "")
    .split(",")[0]
    .trim()
    .replace(/^0\.0\.0\.0/, "127.0.0.1");
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const proto =
      forwardedProto?.split(",")[0].trim() ||
      (request.nextUrl?.protocol === "https:" ? "https" : "http");
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin.replace("://0.0.0.0", "://127.0.0.1");
}

export function buildWidgetEmbedScript(origin: string, widgetKey: string) {
  return `(() => {
  var KEY = ${JSON.stringify(widgetKey)};
  var ORIGIN = ${JSON.stringify(origin)};
  var MAX_WIDTH = ${JSON.stringify(WIDGET_MAX_WIDTH)};
  var MAX_HEIGHT = ${JSON.stringify(WIDGET_MAX_HEIGHT)};
  var LAUNCHER = ${JSON.stringify(String(WIDGET_LAUNCHER_SIZE_PX) + "px")};
  var DESKTOP_WIDTH = ${JSON.stringify(String(WIDGET_DESKTOP_WIDTH_PX) + "px")};
  var DESKTOP_HEIGHT = ${JSON.stringify(String(WIDGET_DESKTOP_HEIGHT_PX) + "px")};
  var EDGE = ${JSON.stringify(WIDGET_EDGE_OFFSET)};
  var SOURCE = ${JSON.stringify(WIDGET_POST_MESSAGE_SOURCE)};
  if (document.getElementById(${JSON.stringify(WIDGET_IFRAME_ID)})) return;
  var iframe = document.createElement("iframe");
  var isOpen = false;
  iframe.id = ${JSON.stringify(WIDGET_IFRAME_ID)};
  iframe.title = "BizPilot chat";
  iframe.src = ORIGIN + "/embed/" + encodeURIComponent(KEY);
  iframe.setAttribute("allowtransparency", "true");
  iframe.style.position = "fixed";
  iframe.style.zIndex = "2147483647";
  iframe.style.border = "0";
  iframe.style.background = "transparent";
  iframe.style.colorScheme = "light";
  iframe.style.overflow = "hidden";
  iframe.style.maxWidth = MAX_WIDTH;
  iframe.style.maxHeight = MAX_HEIGHT;
  function isMobile() {
    return window.matchMedia && window.matchMedia(${JSON.stringify(WIDGET_MOBILE_MEDIA)}).matches;
  }
  function applyCollapsed() {
    isOpen = false;
    iframe.style.width = LAUNCHER;
    iframe.style.height = LAUNCHER;
    iframe.style.right = EDGE;
    iframe.style.bottom = EDGE;
    iframe.style.borderRadius = "999px";
    iframe.style.boxShadow = "none";
  }
  function applyExpanded() {
    isOpen = true;
    iframe.style.maxWidth = MAX_WIDTH;
    iframe.style.maxHeight = MAX_HEIGHT;
    iframe.style.right = EDGE;
    iframe.style.bottom = EDGE;
    iframe.style.borderRadius = "16px";
    iframe.style.boxShadow = "0 18px 50px rgba(15,23,42,.25)";
    if (isMobile()) {
      iframe.style.width = MAX_WIDTH;
      iframe.style.height = MAX_HEIGHT;
    } else {
      iframe.style.width = DESKTOP_WIDTH;
      iframe.style.height = DESKTOP_HEIGHT;
    }
  }
  applyCollapsed();
  document.body.appendChild(iframe);
  window.addEventListener("message", function (event) {
    if (event.origin !== ORIGIN) return;
    var data = event.data || {};
    if (data.source !== SOURCE) return;
    if (data.type === "open") applyExpanded();
    if (data.type === "close") applyCollapsed();
  });
  window.addEventListener("resize", function () {
    if (isOpen) applyExpanded();
  });
})();`;
}
