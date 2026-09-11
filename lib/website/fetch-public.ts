import { gunzipSync } from "node:zlib";
import { WEBSITE_FETCH_TIMEOUT_MS } from "./types";
import { isSameRegisteredDomain } from "./urls";
import type { WebsiteFetchLike } from "./verify";

export const MAX_PUBLIC_REDIRECTS = 8;

export const INDEXER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; BizPilotWebsiteIndexer/1.0; +https://bizpilot-ai-mocha.vercel.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8",
  "Accept-Encoding": "gzip, deflate",
};

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export function decodeFetchedBody(bytes: Buffer | Uint8Array) {
  const buf = Buffer.from(bytes);
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    try {
      return gunzipSync(buf).toString("utf8").replace(/^\uFEFF/, "");
    } catch {
      return buf.toString("utf8").replace(/^\uFEFF/, "");
    }
  }
  return buf.toString("utf8").replace(/^\uFEFF/, "");
}

function isHttpsUrl(raw: string) {
  try {
    return new URL(raw).protocol === "https:";
  } catch {
    return false;
  }
}

async function readResponseBody(response: Awaited<ReturnType<WebsiteFetchLike>>) {
  const withBuffer = response as Awaited<ReturnType<WebsiteFetchLike>> & {
    arrayBuffer?: () => Promise<ArrayBuffer>;
  };
  if (typeof withBuffer.arrayBuffer === "function") {
    return decodeFetchedBody(Buffer.from(await withBuffer.arrayBuffer()));
  }
  return decodeFetchedBody(Buffer.from(await response.text()));
}

export async function fetchPublicUrl(
  fetchImpl: WebsiteFetchLike,
  startUrl: string,
  domain: string,
  init?: { headers?: Record<string, string> },
): Promise<{
  url: string;
  status: number;
  ok: boolean;
  body: string;
  headers: { get(name: string): string | null };
} | null> {
  let current = startUrl;
  const seen = new Set<string>();
  for (let hop = 0; hop <= MAX_PUBLIC_REDIRECTS; hop++) {
    if (seen.has(current)) return null;
    seen.add(current);
    if (!isHttpsUrl(current) || !isSameRegisteredDomain(current, domain)) return null;
    let response: Awaited<ReturnType<WebsiteFetchLike>>;
    try {
      response = await fetchImpl(current, {
        headers: { ...INDEXER_HEADERS, ...init?.headers },
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
    let body = "";
    try {
      body = await readResponseBody(response);
    } catch {
      body = "";
    }
    if (!isHttpsUrl(resolvedUrl) || !isSameRegisteredDomain(resolvedUrl, domain)) {
      return { url: resolvedUrl, status: response.status, ok: false, body, headers: response.headers };
    }
    return { url: resolvedUrl, status: response.status, ok: response.ok, body, headers: response.headers };
  }
  return null;
}
