import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BIZLYRO_PUBLIC_ORIGIN,
  canonicalPublicOrigin,
  crawlerUserAgent,
  LEGACY_WIDGET_ORIGINS,
  PRODUCTION_PUBLIC_ORIGIN,
  PRODUCTION_WIDGET_ORIGIN,
  publicOriginForHost,
} from "./public-origin";

describe("live public origin", () => {
  it("uses www.mybizpilotai.com as the production widget origin", () => {
    assert.equal(PRODUCTION_PUBLIC_ORIGIN, "https://www.mybizpilotai.com");
    assert.equal(PRODUCTION_WIDGET_ORIGIN, PRODUCTION_PUBLIC_ORIGIN);
    assert.ok(LEGACY_WIDGET_ORIGINS.includes("https://bizpilot-ai-mocha.vercel.app"));
    assert.ok(LEGACY_WIDGET_ORIGINS.includes("https://mybizpilotai.com"));
    assert.match(crawlerUserAgent("BizPilotVerify"), /www\.mybizpilotai\.com/);
    assert.doesNotMatch(crawlerUserAgent("BizPilotWebsiteIndexer"), /vercel\.app/);
  });

  it("uses bizlyro.com for that host and keeps www.mybizpilotai.com for the existing domain", () => {
    assert.equal(BIZLYRO_PUBLIC_ORIGIN, "https://bizlyro.com");
    assert.equal(publicOriginForHost("bizlyro.com"), "https://bizlyro.com");
    assert.equal(publicOriginForHost("www.bizlyro.com"), "https://bizlyro.com");
    assert.equal(publicOriginForHost("BIZLYRO.com:443"), "https://bizlyro.com");
    assert.equal(publicOriginForHost("www.mybizpilotai.com"), "https://www.mybizpilotai.com");
    assert.equal(publicOriginForHost("mybizpilotai.com"), "https://www.mybizpilotai.com");
    assert.equal(publicOriginForHost("bizpilot.vercel.app"), PRODUCTION_PUBLIC_ORIGIN);
  });

  it("uses APP_URL when it is a public https origin and ignores local URLs", () => {
    assert.equal(canonicalPublicOrigin("https://www.mybizpilotai.com/"), "https://www.mybizpilotai.com");
    assert.equal(canonicalPublicOrigin("http://127.0.0.1:43127"), null);
    assert.equal(canonicalPublicOrigin(""), null);
  });
});
