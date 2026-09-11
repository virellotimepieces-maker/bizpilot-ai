import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  buildWidgetEmbedScript,
  buildWidgetHostMessage,
  isWidgetHostMessage,
  WIDGET_DESKTOP_HEIGHT_PX,
  WIDGET_DESKTOP_WIDTH_PX,
  WIDGET_IFRAME_ID,
  WIDGET_LAUNCHER_SIZE_PX,
  WIDGET_MAX_HEIGHT,
  WIDGET_MAX_WIDTH,
  WIDGET_MOBILE_BOTTOM,
  WIDGET_MOBILE_MEDIA,
  WIDGET_MOBILE_RIGHT,
  WIDGET_Z_INDEX,
  widgetEmbedPath,
  widgetScriptPath,
} from "./widget-embed-script";

const ORIGIN = "https://bizpilot-ai-mocha.vercel.app";
const KEY = "bpw_existing_widget_key";

describe("generated /w/[widget-id].js embed script", () => {
  const script = buildWidgetEmbedScript(ORIGIN, KEY);

  it("keeps the existing widget iframe id and embed URL", () => {
    assert.equal(WIDGET_IFRAME_ID, "bizpilot-widget");
    assert.equal(widgetScriptPath(KEY), `/w/${KEY}.js`);
    assert.equal(widgetEmbedPath(KEY), `/embed/${KEY}`);
    assert.match(script, /iframe\.id = "bizpilot-widget"/);
    assert.match(script, /ORIGIN \+ "\/embed\/" \+ encodeURIComponent\(KEY\)/);
    assert.match(script, new RegExp(JSON.stringify(KEY)));
    assert.doesNotMatch(script, /\/w\/preview/);
  });

  it("starts collapsed and never auto-opens the chat window", () => {
    assert.match(script, /applyCollapsed\(\);\s*document\.body\.appendChild\(iframe\)/);
    assert.doesNotMatch(script, /applyExpanded\(\);\s*document\.body\.appendChild/);
    assert.doesNotMatch(script, /applyExpanded\(\);\s*\}\)\(\)/);
    assert.match(script, /var isOpen = false/);
    assert.match(script, new RegExp(`LAUNCHER = "${WIDGET_LAUNCHER_SIZE_PX}px"`));
  });

  it("opens only after a postMessage from the iframe and closes the same way", () => {
    assert.match(script, /data\.type === "open"\) applyExpanded\(\)/);
    assert.match(script, /data\.type === "close"\) applyCollapsed\(\)/);
    assert.match(script, /event\.origin !== ORIGIN/);
    assert.deepEqual(buildWidgetHostMessage("open"), {
      source: "bizpilot-widget",
      type: "open",
    });
    assert.equal(isWidgetHostMessage({ source: "bizpilot-widget", type: "close" }), true);
    assert.equal(isWidgetHostMessage({ source: "other", type: "open" }), false);
  });

  it("keeps the open window inside the visible screen on mobile", () => {
    assert.equal(WIDGET_MAX_HEIGHT, "calc(100dvh - 120px)");
    assert.equal(WIDGET_MAX_WIDTH, "calc(100vw - 24px)");
    assert.match(script, /MAX_HEIGHT = "calc\(100dvh - 120px\)"/);
    assert.match(script, /MAX_WIDTH = "calc\(100vw - 24px\)"/);
    assert.match(script, /iframe\.style\.maxWidth = MAX_WIDTH/);
    assert.match(script, /iframe\.style\.maxHeight = MAX_HEIGHT/);
    assert.match(script, /iframe\.style\.width = MAX_WIDTH/);
    assert.match(script, /iframe\.style\.height = MAX_HEIGHT/);
    assert.match(script, new RegExp(WIDGET_MOBILE_MEDIA.replace("(", "\\(").replace(")", "\\)")));
    assert.match(
      script,
      new RegExp(`DESKTOP_WIDTH = "${WIDGET_DESKTOP_WIDTH_PX}px"`),
    );
    assert.match(
      script,
      new RegExp(`DESKTOP_HEIGHT = "${WIDGET_DESKTOP_HEIGHT_PX}px"`),
    );
    assert.doesNotMatch(script, /width:100vw|height:100vh|height:100dvh|width:\s*100%/);
  });

  it("sits above the Shopify preview bar on screens below 768px", () => {
    assert.equal(WIDGET_MOBILE_MEDIA, "(max-width: 767px)");
    assert.equal(WIDGET_MOBILE_RIGHT, "16px");
    assert.equal(WIDGET_MOBILE_BOTTOM, "120px");
    assert.equal(WIDGET_Z_INDEX, "2147483647");
    assert.match(script, /MOBILE_RIGHT = "16px"/);
    assert.match(script, /MOBILE_BOTTOM = "120px"/);
    assert.match(script, /iframe\.style\.zIndex = "2147483647"/);
    assert.match(script, /iframe\.style\.right = isMobile\(\) \? MOBILE_RIGHT : EDGE/);
    assert.match(script, /iframe\.style\.bottom = isMobile\(\) \? MOBILE_BOTTOM : EDGE/);
    assert.match(script, /applyAnchor\(\);\s*if \(isMobile\(\)\)/);
    assert.match(script, /function applyCollapsed\(\)[\s\S]*applyAnchor\(\)/);
    assert.match(script, /minWidth = LAUNCHER/);
    assert.match(script, /minHeight = LAUNCHER/);
  });
});

describe("widget embed route wiring", () => {
  it("serves the generated script without changing the /w/:key.js URL", () => {
    const route = readFileSync("app/w/[widgetKey]/route.ts", "utf8");
    const config = readFileSync("next.config.ts", "utf8");
    assert.match(route, /buildWidgetEmbedScript/);
    assert.match(route, /widgetKey: raw/);
    assert.match(route, /\.js\$/);
    assert.match(config, /source: "\/w\/:key\.js"/);
    assert.match(config, /destination: "\/w\/:key"/);
  });

  it("does not put secrets in the embed script builder", () => {
    const source = readFileSync("lib/widget-embed-script.ts", "utf8");
    assert.doesNotMatch(source, /OPENAI_API_KEY|DATABASE_URL|STRIPE_SECRET_KEY|AUTH_SECRET/);
  });

  it("uses the request host so local 0.0.0.0 binds still match the page origin", async () => {
    const { widgetScriptOrigin } = await import("./widget-embed-script");
    assert.equal(
      widgetScriptOrigin({
        url: "http://0.0.0.0:43217/w/bpw_existing_widget_key.js",
        headers: { get: (name: string) => (name === "host" ? "127.0.0.1:43217" : null) },
      }),
      "http://127.0.0.1:43217",
    );
    assert.equal(
      widgetScriptOrigin({
        url: "http://0.0.0.0:43217/w/live.js",
        headers: {
          get: (name: string) => {
            if (name === "x-forwarded-host") return "bizpilot-ai-mocha.vercel.app";
            if (name === "x-forwarded-proto") return "https";
            return null;
          },
        },
      }),
      "https://bizpilot-ai-mocha.vercel.app",
    );
  });
});
