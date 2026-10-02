import { BillingError } from "@/lib/billing/types";
import { SHOPIFY_API_VERSION } from "./config";

type FetchLike = typeof fetch;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function shopifyHttpError(status: number, mode: "connect" | "admin"): BillingError {
  if (status === 401 || status === 403) {
    return new BillingError(
      mode === "connect"
        ? "Shopify denied this store connection. Try Connect Shopify again."
        : "Shopify access was revoked or expired. Connect Shopify again.",
      mode === "connect" ? "invalid" : "reconnect",
    );
  }
  if (status === 429) {
    return new BillingError("Shopify is rate-limiting this store. Try Sync now in a moment.", "limit");
  }
  if (status >= 500) {
    return new BillingError("Shopify is temporarily unavailable. Try again shortly.", "invalid");
  }
  return new BillingError("Shopify request failed.", "invalid");
}

export type ShopifyTokenSet = {
  accessToken: string;
  scope: string;
};

export async function exchangeShopifyAuthorizationCode(
  input: {
    shop: string;
    code: string;
    apiKey: string;
    apiSecret: string;
  },
  fetchImpl: FetchLike = fetch,
): Promise<ShopifyTokenSet> {
  const response = await fetchImpl(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: input.apiKey,
      client_secret: input.apiSecret,
      code: input.code,
    }),
  });
  const json = await readJson(response);
  if (!response.ok) {
    throw shopifyHttpError(response.status, "connect");
  }
  const row = asRecord(json);
  const accessToken = typeof row?.access_token === "string" ? row.access_token : "";
  const scope = typeof row?.scope === "string" ? row.scope : "";
  if (!accessToken) {
    throw new BillingError("Shopify did not grant an access token. Connect Shopify again.", "invalid");
  }
  return { accessToken, scope };
}

export type ShopifyShopInfo = {
  name: string;
  myshopifyDomain: string;
  primaryDomain: string;
};

export type ShopifyAdminProduct = {
  id?: number | string;
  title?: string;
  body_html?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  handle?: string | null;
  status?: string | null;
  tags?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  images?: { src?: string | null }[];
  variants?: {
    id?: number | string;
    title?: string | null;
    sku?: string | null;
    price?: string | null;
    compare_at_price?: string | null;
    inventory_quantity?: number | null;
    inventory_management?: string | null;
    inventory_policy?: string | null;
  }[];
};

export async function shopifyAdminJson<T>(input: {
  shop: string;
  accessToken: string;
  path: string;
  method?: string;
  body?: unknown;
  fetchImpl?: FetchLike;
}): Promise<{ data: T; link: string | null }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
  const response = await fetchImpl(`https://${input.shop}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    method: input.method ?? "GET",
    headers: {
      "X-Shopify-Access-Token": input.accessToken,
      Accept: "application/json",
      ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  });
  const json = await readJson(response);
  if (!response.ok) {
    throw shopifyHttpError(response.status, "admin");
  }
  return { data: json as T, link: response.headers.get("link") };
}

export function nextShopifyPageInfo(linkHeader: string | null) {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/i);
  return match ? decodeURIComponent(match[1]) : null;
}

export async function fetchShopifyShop(
  input: { shop: string; accessToken: string },
  fetchImpl: FetchLike = fetch,
): Promise<ShopifyShopInfo> {
  const { data } = await shopifyAdminJson<{ shop?: Record<string, unknown> }>({
    ...input,
    path: "/shop.json",
    fetchImpl,
  });
  const shop = asRecord(data?.shop) ?? {};
  const myshopifyDomain =
    typeof shop.myshopify_domain === "string" ? shop.myshopify_domain : input.shop;
  const primary =
    typeof shop.domain === "string" && shop.domain.trim()
      ? shop.domain.trim()
      : myshopifyDomain;
  return {
    name: typeof shop.name === "string" ? shop.name : "",
    myshopifyDomain,
    primaryDomain: primary.replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
  };
}

export async function fetchAllShopifyProducts(
  input: { shop: string; accessToken: string },
  fetchImpl: FetchLike = fetch,
): Promise<ShopifyAdminProduct[]> {
  const products: ShopifyAdminProduct[] = [];
  let pageInfo: string | null = null;
  for (let i = 0; i < 40; i += 1) {
    const path = pageInfo
      ? `/products.json?limit=250&page_info=${encodeURIComponent(pageInfo)}`
      : "/products.json?limit=250";
    const { data, link } = await shopifyAdminJson<{ products?: ShopifyAdminProduct[] }>({
      ...input,
      path,
      fetchImpl,
    });
    products.push(...(data?.products ?? []));
    pageInfo = nextShopifyPageInfo(link);
    if (!pageInfo) break;
  }
  return products;
}

export async function revokeShopifyToken(
  input: { shop: string; accessToken: string },
  fetchImpl: FetchLike = fetch,
) {
  try {
    await fetchImpl(`https://${input.shop}/admin/api_permissions/current.json`, {
      method: "DELETE",
      headers: { "X-Shopify-Access-Token": input.accessToken },
    });
  } catch {
    // Local disconnect still proceeds if Shopify revoke fails.
  }
}
