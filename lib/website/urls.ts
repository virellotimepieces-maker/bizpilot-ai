import type { WebsitePageKind } from "./types";

const PRIVATE_PATH =
  /(^|\/)(checkouts?|cart|account|accounts|admin|login|signin|signup|register|orders?|password|customer_authentication|wp-admin|wp-login\.php|cdn-cgi|challenge|wallets|customer_account)(\/|$)/i;

export function normalizeWebsiteDomain(input: string) {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let hostname = "";
  try {
    hostname = new URL(withProtocol).hostname;
  } catch {
    return "";
  }
  hostname = hostname.replace(/^www\./, "");
  if (!hostname || hostname === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return "";
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(hostname)) return "";
  return hostname;
}

export function websiteOrigin(domain: string) {
  return `https://${domain.replace(/^www\./, "")}`;
}

export function isPrivateOrUnsafeUrl(raw: string) {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  if (parsed.username || parsed.password) return true;
  const host = parsed.hostname.toLowerCase();
  if (host.startsWith("checkout.") || host.startsWith("admin.") || host.startsWith("account.")) {
    return true;
  }
  return PRIVATE_PATH.test(parsed.pathname);
}

export function isSameRegisteredDomain(raw: string, domain: string) {
  let host = "";
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return false;
  }
  const root = domain.replace(/^www\./, "").toLowerCase();
  return host === root;
}

export function classifyWebsitePage(url: string, title = ""): WebsitePageKind {
  const path = safePath(url);
  const hay = `${path} ${title}`.toLowerCase();
  if (/\/products?\//.test(path)) return "product";
  if (/\/services?\//.test(path) || /\/collections\/services/.test(path)) return "service";
  if (/faq|frequently[-_]asked/.test(hay)) return "faq";
  if (/\/pages\/about|\/about/.test(path) || /\babout\b/.test(title.toLowerCase())) return "about";
  if (/contact/.test(hay)) return "contact";
  if (/shipping|delivery/.test(hay)) return "shipping";
  if (/refund|return|exchange/.test(hay)) return "returns";
  if (/privacy/.test(hay)) return "privacy";
  if (/terms|conditions/.test(hay)) return "terms";
  if (/\/policies\//.test(path)) return "policy";
  return "other";
}

export function websitePagePriority(kind: WebsitePageKind) {
  switch (kind) {
    case "shipping":
    case "returns":
    case "privacy":
    case "terms":
    case "policy":
      return 0;
    case "faq":
    case "about":
    case "contact":
      return 1;
    case "product":
    case "service":
      return 2;
    default:
      return 3;
  }
}

export function shouldIndexWebsiteUrl(url: string, title = "") {
  if (isPrivateOrUnsafeUrl(url)) return false;
  const kind = classifyWebsitePage(url, title);
  if (kind !== "other") return true;
  const path = safePath(url).replace(/\/$/, "") || "/";
  if (path === "/") return true;
  if (/\/pages\//.test(path)) return true;
  return false;
}

function safePath(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
