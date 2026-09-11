import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getWidgetInstallGuide,
  WIDGET_INSTALL_GUIDE_LAYOUT_CLASS,
  WIDGET_PLATFORMS,
  WIDGET_SECRET_WARNING,
  WIDGET_TROUBLESHOOTING,
  WIDGET_VERIFY_STEPS,
  type WidgetPlatformId,
} from "./widget-install-guides";

describe("widget install guides", () => {
  it("covers Shopify, WordPress, Wix, Squarespace, and custom HTML", () => {
    assert.deepEqual(
      WIDGET_PLATFORMS.map((row) => row.label),
      ["Shopify", "WordPress", "Wix", "Squarespace", "Custom HTML website"],
    );
    for (const platform of WIDGET_PLATFORMS) {
      const guide = getWidgetInstallGuide(platform.id);
      assert.equal(guide.id, platform.id);
      assert.ok(guide.steps.length >= 4);
      assert.ok(guide.pasteWhere.length > 20);
      assert.ok(guide.publishHow.length > 20);
    }
  });

  it("tells subscribers where to paste the snippet and how to publish", () => {
    const checks: Record<WidgetPlatformId, RegExp> = {
      shopify: /theme\.liquid|Custom Liquid|footer/i,
      wordpress: /Footer/i,
      wix: /Body/i,
      squarespace: /Footer/i,
      custom: /<\/body>/,
    };
    for (const platform of WIDGET_PLATFORMS) {
      const guide = getWidgetInstallGuide(platform.id);
      assert.match(guide.pasteWhere, checks[platform.id]);
      assert.match(guide.publishHow, /Save|Publish|publish|deploy/i);
      assert.ok(guide.steps.some((step) => /paste/i.test(step)));
      assert.ok(guide.steps.some((step) => /Save|Publish|publish|upload|deploy/i.test(step)));
    }
  });

  it("includes a public-site verification step", () => {
    assert.ok(WIDGET_VERIFY_STEPS.length >= 3);
    const text = WIDGET_VERIFY_STEPS.join(" ");
    assert.match(text, /public website/i);
    assert.match(text, /bottom-right|launcher/i);
  });

  it("covers the required troubleshooting cases", () => {
    const titles = WIDGET_TROUBLESHOOTING.map((row) => row.title);
    assert.ok(titles.includes("Widget does not appear"));
    assert.ok(titles.includes("Cache or CDN delay"));
    assert.ok(titles.includes("Snippet pasted more than once"));
    assert.ok(titles.includes("Subscription inactive"));
    assert.ok(titles.includes("Content Security Policy blocking the script"));
  });

  it("warns never to share secrets and stays readable on narrow screens", () => {
    assert.match(WIDGET_SECRET_WARNING, /Never share API keys/i);
    assert.match(WIDGET_SECRET_WARNING, /database credentials|passwords/i);
    assert.match(WIDGET_SECRET_WARNING, /snippet/i);
    assert.match(WIDGET_INSTALL_GUIDE_LAYOUT_CLASS, /break-words/);
    assert.match(WIDGET_INSTALL_GUIDE_LAYOUT_CLASS, /leading-relaxed/);
  });
});
