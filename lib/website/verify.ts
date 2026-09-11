import { widgetScriptPath } from "@/lib/widget-embed-script";
import { WEBSITE_FETCH_TIMEOUT_MS } from "./types";
import { isSameRegisteredDomain } from "./urls";

export const PRODUCTION_WIDGET_ORIGIN = "https://bizpilot-ai-mocha.vercel.app";
export const MAX_HOMEPAGE_REDIRECTS = 8;

export type WebsiteFetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal; redirect?: RequestRedirect },
) => Promise<{
  ok: boolean;
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export type WebsiteVerifyDiagnostic = {
  fetchedUrl: string | null;
  status: number | null;
  expectedPath: string;
  foundScriptPathname: boolean;
};

export type ParsedWidgetScriptSrc = {
  raw: string;
  origin: string;
  pathname: string;
};

export type HomepageWidgetInspection = {
  scripts: ParsedWidgetScriptSrc[];
  foundScriptPathname: boolean;
  matched: boolean;
};

const VERIFY_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; BizPilotVerify/1.0; +https://bizpilot-ai-mocha.vercel.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
};

const SCRIPT_SRC_ATTR =
  /<script\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^>\s]+))/gi;

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export function expectedWidgetScriptPath(widgetKey: string) {
  return widgetScriptPath(widgetKey);
}

export function normalizeTrustedOrigin(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const origin = new URL(withProtocol).origin;
    return origin || null;
  } catch {
    return null;
  }
}

export function trustedWidgetOrigins(env?: { APP_URL?: string; VERCEL_URL?: string }) {
  const source = env ?? { APP_URL: process.env.APP_URL, VERCEL_URL: process.env.VERCEL_URL };
  const origins = new Set<string>();
  const production = normalizeTrustedOrigin(PRODUCTION_WIDGET_ORIGIN);
  if (production) origins.add(production);
  const appUrl = normalizeTrustedOrigin(source.APP_URL ?? "");
  if (appUrl) origins.add(appUrl);
  const vercel = source.VERCEL_URL?.trim();
  if (vercel) {
    const fromVercel = normalizeTrustedOrigin(vercel);
    if (fromVercel) origins.add(fromVercel);
  }
  return [...origins];
}

export function isTrustedWidgetOrigin(origin: string, trustedOrigins: string[]) {
  const normalized = normalizeTrustedOrigin(origin);
  if (!normalized) return false;
  return trustedOrigins.some((candidate) => normalizeTrustedOrigin(candidate) === normalized);
}

export function isExpectedWidgetPathname(pathname: string, widgetKey: string) {
  return pathname === widgetScriptPath(widgetKey) || pathname === `/w/${widgetKey}`;
}

function decodeHtmlAttr(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCharCode(Number(dec)));
}

export function extractScriptSrcs(html: string) {
  const srcs: string[] = [];
  for (const match of html.matchAll(SCRIPT_SRC_ATTR)) {
    const raw = match[1] ?? match[2] ?? match[3];
    if (raw) srcs.push(decodeHtmlAttr(raw.trim()));
  }
  return srcs;
}

export function parseScriptSrc(src: string, pageUrl: string): ParsedWidgetScriptSrc | null {
  try {
    const url = new URL(src, pageUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return {
      raw: src,
      origin: url.origin,
      pathname: url.pathname,
    };
  } catch {
    return null;
  }
}

export function inspectHomepageWidgetScripts(
  html: string,
  widgetKey: string,
  options: { pageUrl: string; trustedOrigins: string[] },
): HomepageWidgetInspection {
  const scripts = extractScriptSrcs(html)
    .map((src) => parseScriptSrc(src, options.pageUrl))
    .filter((script): script is ParsedWidgetScriptSrc => Boolean(script));
  const foundScriptPathname = scripts.some((script) => isExpectedWidgetPathname(script.pathname, widgetKey));
  const matched = scripts.some(
    (script) =>
      isExpectedWidgetPathname(script.pathname, widgetKey) &&
      isTrustedWidgetOrigin(script.origin, options.trustedOrigins),
  );
  return { scripts, foundScriptPathname, matched };
}

export function homepageHasWidgetSnippet(
  html: string,
  widgetKey: string,
  options?: { pageUrl?: string; trustedOrigins?: string[] },
) {
  return inspectHomepageWidgetScripts(html, widgetKey, {
    pageUrl: options?.pageUrl ?? "https://example.invalid/",
    trustedOrigins: options?.trustedOrigins ?? trustedWidgetOrigins(),
  }).matched;
}

export function wellKnownTokenMatches(body: string, token: string) {
  return body.trim() === token.trim();
}

export function verificationInstructions(domain: string, widgetKey: string, token: string) {
  return `Install the BizPilot snippet on ${domain} (it includes /w/${widgetKey}.js), or publish ${token} at https://${domain}/.well-known/bizpilot-verify.txt, then click Verify domain.`;
}

export function emptyWebsiteVerifyDiagnostic(widgetKey: string): WebsiteVerifyDiagnostic {
  return {
    fetchedUrl: null,
    status: null,
    expectedPath: expectedWidgetScriptPath(widgetKey),
    foundScriptPathname: false,
  };
}

export function formatWebsiteVerifyFailure(diagnostic: WebsiteVerifyDiagnostic) {
  const fetched =
    diagnostic.fetchedUrl == null
      ? "The public homepage could not be fetched."
      : `Fetched ${diagnostic.fetchedUrl} (${diagnostic.status == null ? "no HTTP status" : `HTTP ${diagnostic.status}`}).`;
  const path = diagnostic.foundScriptPathname
    ? `Expected widget path ${diagnostic.expectedPath} was found.`
    : `Expected widget path ${diagnostic.expectedPath} was not found.`;
  return `Could not verify that domain. Confirm the BizPilot snippet is on the live homepage, or publish the verification file, then try again. ${fetched} ${path}`;
}

function isHttpsUrl(raw: string) {
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

export async function fetchPublicHomepageHtml(
  fetchImpl: WebsiteFetchLike,
  startUrl: string,
  domain: string,
): Promise<{ url: string; status: number; ok: boolean; body: string } | null> {
  let current = startUrl;
  const seen = new Set<string>();
  for (let hop = 0; hop <= MAX_HOMEPAGE_REDIRECTS; hop++) {
    if (seen.has(current)) return null;
    seen.add(current);
    if (!isHttpsUrl(current) || !isSameRegisteredDomain(current, domain)) return null;
    let response: Awaited<ReturnType<WebsiteFetchLike>>;
    try {
      response = await fetchImpl(current, {
        headers: VERIFY_HEADERS,
        signal: AbortSignal.timeout(WEBSITE_FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
    } catch {
      return null;
    }
    const resolvedUrl = response.url || current;
    const location = response.headers.get("location");
    if (REDIRECT_STATUS.has(response.status) && location) {
      try {
        current = new URL(location, resolvedUrl).href;
      } catch {
        return null;
      }
      continue;
    }
    if (!isHttpsUrl(resolvedUrl) || !isSameRegisteredDomain(resolvedUrl, domain)) {
      const body = await response.text().catch(() => "");
      return { url: resolvedUrl, status: response.status, ok: false, body };
    }
    const body = await response.text();
    return { url: resolvedUrl, status: response.status, ok: response.ok, body };
  }
  return null;
}

export async function verifyWebsiteOwnership(input: {
  domain: string;
  widgetKey: string;
  token: string;
  fetchImpl?: WebsiteFetchLike;
  trustedOrigins?: string[];
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const trustedOrigins = input.trustedOrigins ?? trustedWidgetOrigins();
  const diagnostic = emptyWebsiteVerifyDiagnostic(input.widgetKey);
  const origin = `https://${input.domain.replace(/^www\./, "")}`;
  const homepage = await fetchPublicHomepageHtml(fetchImpl, `${origin}/`, input.domain);
  if (homepage) {
    diagnostic.fetchedUrl = homepage.url;
    diagnostic.status = homepage.status;
    const inspection = inspectHomepageWidgetScripts(homepage.body, input.widgetKey, {
      pageUrl: homepage.url,
      trustedOrigins,
    });
    diagnostic.foundScriptPathname = inspection.foundScriptPathname;
    if (homepage.ok && inspection.matched) {
      return { verified: true, method: "widget_snippet" as const, diagnostic };
    }
  }
  const wellKnown = await fetchPublicHomepageHtml(
    fetchImpl,
    `${origin}/.well-known/bizpilot-verify.txt`,
    input.domain,
  ).catch(() => null);
  if (wellKnown?.ok && wellKnownTokenMatches(wellKnown.body, input.token)) {
    return { verified: true, method: "well_known" as const, diagnostic };
  }
  return { verified: false, method: null, diagnostic };
}
