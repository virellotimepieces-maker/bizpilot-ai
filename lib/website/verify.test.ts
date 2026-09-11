import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCTION_WIDGET_ORIGIN,
  expectedWidgetScriptPath,
  extractScriptSrcs,
  fetchPublicHomepageHtml,
  formatWebsiteVerifyFailure,
  homepageHasWidgetSnippet,
  inspectHomepageWidgetScripts,
  parseScriptSrc,
  trustedWidgetOrigins,
  verifyWebsiteOwnership,
  type WebsiteFetchLike,
} from "./verify";

const ORIGIN = PRODUCTION_WIDGET_ORIGIN;
const KEY = "bpw_R_LPQ9YnXP40v9tf98PUpao1MNrZKIzM";
const DOMAIN = "harborandpine.com";
const TRUSTED = [ORIGIN];

function scriptTag(src: string) {
  return `<!doctype html><html><head></head><body><script src="${src}" async></script></body></html>`;
}

function mockFetch(
  routes: Record<
    string,
    { status?: number; body?: string; location?: string; url?: string }
  >,
): WebsiteFetchLike {
  return async (url) => {
    const route = routes[url];
    if (!route) {
      return {
        ok: false,
        status: 404,
        url,
        headers: { get: () => null },
        text: async () => "",
      };
    }
    const status = route.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      url: route.url ?? url,
      headers: {
        get: (name) =>
          name.toLowerCase() === "location" ? route.location ?? null : null,
      },
      text: async () => route.body ?? "",
    };
  };
}

describe("widget script URL matching", () => {
  it("parses script src origin and pathname and ignores query parameters and fragments", () => {
    const pageUrl = `https://${DOMAIN}/`;
    const withQuery = parseScriptSrc(`${ORIGIN}/w/${KEY}.js?v=0c6fa93`, pageUrl);
    const withOtherQuery = parseScriptSrc(`${ORIGIN}/w/${KEY}.js?cache=bust&x=1`, pageUrl);
    const withHash = parseScriptSrc(`${ORIGIN}/w/${KEY}.js#frag`, pageUrl);
    const plain = parseScriptSrc(`${ORIGIN}/w/${KEY}.js`, pageUrl);
    assert.equal(plain?.origin, ORIGIN);
    assert.equal(plain?.pathname, `/w/${KEY}.js`);
    assert.equal(withQuery?.origin, ORIGIN);
    assert.equal(withQuery?.pathname, `/w/${KEY}.js`);
    assert.equal(withOtherQuery?.pathname, `/w/${KEY}.js`);
    assert.equal(withHash?.pathname, `/w/${KEY}.js`);
    assert.notEqual(withQuery?.raw, `${ORIGIN}/w/${KEY}.js`);
  });

  it("accepts the expected widget script with a plain .js src", () => {
    const html = scriptTag(`${ORIGIN}/w/${KEY}.js`);
    const inspection = inspectHomepageWidgetScripts(html, KEY, {
      pageUrl: `https://${DOMAIN}/`,
      trustedOrigins: TRUSTED,
    });
    assert.equal(inspection.matched, true);
    assert.equal(inspection.foundScriptPathname, true);
    assert.equal(homepageHasWidgetSnippet(html, KEY, { trustedOrigins: TRUSTED }), true);
  });

  it("accepts a Shopify cache-busting ?v=commit query", () => {
    const html = scriptTag(`${ORIGIN}/w/${KEY}.js?v=0c6fa93`);
    const inspection = inspectHomepageWidgetScripts(html, KEY, {
      pageUrl: `https://www.${DOMAIN}/`,
      trustedOrigins: TRUSTED,
    });
    assert.equal(inspection.matched, true);
    assert.equal(inspection.foundScriptPathname, true);
  });

  it("accepts other query parameters and URL fragments on the same pathname", () => {
    const html = scriptTag(`${ORIGIN}/w/${KEY}.js?utm=theme&cache=1#widget`);
    const inspection = inspectHomepageWidgetScripts(html, KEY, {
      pageUrl: `https://${DOMAIN}/`,
      trustedOrigins: TRUSTED,
    });
    assert.equal(inspection.matched, true);
    assert.equal(inspection.foundScriptPathname, true);
  });

  it("matches only the exact workspace widget ID", () => {
    const html = scriptTag(`${ORIGIN}/w/bpw_other_widget.js?v=0c6fa93`);
    const inspection = inspectHomepageWidgetScripts(html, KEY, {
      pageUrl: `https://${DOMAIN}/`,
      trustedOrigins: TRUSTED,
    });
    assert.equal(inspection.matched, false);
    assert.equal(inspection.foundScriptPathname, false);
    const prefix = inspectHomepageWidgetScripts(
      scriptTag(`${ORIGIN}/w/${KEY}extra.js`),
      KEY,
      { pageUrl: `https://${DOMAIN}/`, trustedOrigins: TRUSTED },
    );
    assert.equal(prefix.matched, false);
    assert.equal(prefix.foundScriptPathname, false);
  });

  it("matches only a trusted BizPilot origin", () => {
    const html = scriptTag(`https://evil.example/w/${KEY}.js?v=0c6fa93`);
    const inspection = inspectHomepageWidgetScripts(html, KEY, {
      pageUrl: `https://${DOMAIN}/`,
      trustedOrigins: TRUSTED,
    });
    assert.equal(inspection.matched, false);
    assert.equal(inspection.foundScriptPathname, true);
  });

  it("extracts quoted and unquoted script src attributes", () => {
    const html = `<script async src='${ORIGIN}/w/${KEY}.js?v=1'></script><script src=${ORIGIN}/w/${KEY}.js></script>`;
    assert.deepEqual(extractScriptSrcs(html), [
      `${ORIGIN}/w/${KEY}.js?v=1`,
      `${ORIGIN}/w/${KEY}.js`,
    ]);
  });

  it("always trusts the production widget origin", () => {
    assert.ok(trustedWidgetOrigins({}).includes(ORIGIN));
    assert.equal(expectedWidgetScriptPath(KEY), `/w/${KEY}.js`);
  });
});

describe("homepage redirect following", () => {
  it("follows HTTPS redirects and inspects the final public homepage HTML", async () => {
    const html = scriptTag(`${ORIGIN}/w/${KEY}.js?v=0c6fa93`);
    const result = await fetchPublicHomepageHtml(
      mockFetch({
        "https://harborandpine.com/": {
          status: 301,
          location: "https://www.harborandpine.com/",
        },
        "https://www.harborandpine.com/": {
          status: 200,
          body: html,
        },
      }),
      "https://harborandpine.com/",
      DOMAIN,
    );
    assert.equal(result?.ok, true);
    assert.equal(result?.status, 200);
    assert.equal(result?.url, "https://www.harborandpine.com/");
    assert.match(result?.body ?? "", /bpw_R_LPQ9YnXP40v9tf98PUpao1MNrZKIzM\.js\?v=0c6fa93/);
  });

  it("uses the final URL when the fetch implementation already followed the redirect", async () => {
    const html = scriptTag(`${ORIGIN}/w/${KEY}.js`);
    const result = await fetchPublicHomepageHtml(
      mockFetch({
        "https://harborandpine.com/": {
          status: 200,
          url: "https://www.harborandpine.com/",
          body: html,
        },
      }),
      "https://harborandpine.com/",
      DOMAIN,
    );
    assert.equal(result?.url, "https://www.harborandpine.com/");
    assert.equal(result?.ok, true);
  });

  it("does not follow HTTP or off-domain redirects", async () => {
    const http = await fetchPublicHomepageHtml(
      mockFetch({
        "https://harborandpine.com/": {
          status: 302,
          location: "http://harborandpine.com/",
        },
      }),
      "https://harborandpine.com/",
      DOMAIN,
    );
    assert.equal(http, null);
    const offDomain = await fetchPublicHomepageHtml(
      mockFetch({
        "https://harborandpine.com/": {
          status: 301,
          location: "https://attacker.example/",
        },
      }),
      "https://harborandpine.com/",
      DOMAIN,
    );
    assert.equal(offDomain, null);
  });
});

describe("verifyWebsiteOwnership", () => {
  it("verifies a live Shopify homepage whose widget src has ?v=commit", async () => {
    const result = await verifyWebsiteOwnership({
      domain: DOMAIN,
      widgetKey: KEY,
      token: "bpv_unused",
      trustedOrigins: TRUSTED,
      fetchImpl: mockFetch({
        "https://harborandpine.com/": {
          status: 301,
          location: "https://www.harborandpine.com/",
        },
        "https://www.harborandpine.com/": {
          status: 200,
          body: scriptTag(`${ORIGIN}/w/${KEY}.js?v=0c6fa93`),
        },
      }),
    });
    assert.equal(result.verified, true);
    assert.equal(result.method, "widget_snippet");
    assert.equal(result.diagnostic.fetchedUrl, "https://www.harborandpine.com/");
    assert.equal(result.diagnostic.status, 200);
    assert.equal(result.diagnostic.expectedPath, `/w/${KEY}.js`);
    assert.equal(result.diagnostic.foundScriptPathname, true);
  });

  it("returns a diagnostic when the widget ID is wrong", async () => {
    const result = await verifyWebsiteOwnership({
      domain: DOMAIN,
      widgetKey: KEY,
      token: "bpv_unused",
      trustedOrigins: TRUSTED,
      fetchImpl: mockFetch({
        "https://harborandpine.com/": {
          status: 200,
          body: scriptTag(`${ORIGIN}/w/bpw_someone_else.js?v=0c6fa93`),
        },
      }),
    });
    assert.equal(result.verified, false);
    assert.equal(result.method, null);
    assert.equal(result.diagnostic.fetchedUrl, "https://harborandpine.com/");
    assert.equal(result.diagnostic.status, 200);
    assert.equal(result.diagnostic.expectedPath, `/w/${KEY}.js`);
    assert.equal(result.diagnostic.foundScriptPathname, false);
    assert.match(formatWebsiteVerifyFailure(result.diagnostic), /HTTP 200/);
    assert.match(formatWebsiteVerifyFailure(result.diagnostic), /was not found/);
  });

  it("returns a diagnostic when the script origin is not BizPilot", async () => {
    const result = await verifyWebsiteOwnership({
      domain: DOMAIN,
      widgetKey: KEY,
      token: "bpv_unused",
      trustedOrigins: TRUSTED,
      fetchImpl: mockFetch({
        "https://harborandpine.com/": {
          status: 200,
          body: scriptTag(`https://cdn.untrusted.test/w/${KEY}.js`),
        },
      }),
    });
    assert.equal(result.verified, false);
    assert.equal(result.diagnostic.foundScriptPathname, true);
    assert.match(formatWebsiteVerifyFailure(result.diagnostic), /was found/);
  });

  it("still accepts the well-known verification file", async () => {
    const result = await verifyWebsiteOwnership({
      domain: DOMAIN,
      widgetKey: KEY,
      token: "bpv_token",
      trustedOrigins: TRUSTED,
      fetchImpl: mockFetch({
        "https://harborandpine.com/": { status: 200, body: "<html>no widget</html>" },
        "https://harborandpine.com/.well-known/bizpilot-verify.txt": {
          status: 200,
          body: "bpv_token\n",
        },
      }),
    });
    assert.equal(result.verified, true);
    assert.equal(result.method, "well_known");
    assert.equal(result.diagnostic.foundScriptPathname, false);
  });
});
