import { jaccard, tokenize } from "@/lib/website/conflicts";
import type { ShopifyAdminProduct } from "./api";
import type { ShopifyProductRecord, ShopifyProductWrite, ShopifyVariantRecord } from "./types";

export const CATALOG_NO_SOURCE_ANSWER =
  "I don’t have verified Shopify catalog data for that. I can loop in a teammate who can help.";

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asId(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return "";
}

function storefrontUrl(primaryDomain: string, handle: string) {
  const host = primaryDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const slug = handle.replace(/^\/+|\/+$/g, "");
  if (!host || !slug) return "";
  return `https://${host}/products/${slug}`;
}

function mapVariant(row: NonNullable<ShopifyAdminProduct["variants"]>[number]): ShopifyVariantRecord | null {
  const id = asId(row.id);
  if (!id) return null;
  const tracked = Boolean(row.inventory_management);
  const quantity = typeof row.inventory_quantity === "number" ? row.inventory_quantity : null;
  let available: boolean | null = null;
  if (tracked && quantity !== null) {
    available = quantity > 0 || row.inventory_policy === "continue";
  }
  return {
    id,
    title: asString(row.title) || "Default",
    sku: asString(row.sku),
    price: asString(row.price),
    compareAtPrice: row.compare_at_price ? asString(row.compare_at_price) : null,
    available,
    inventoryQuantity: tracked ? quantity : null,
    inventoryTracked: tracked,
  };
}

export function mapShopifyAdminProduct(
  product: ShopifyAdminProduct,
  workspaceId: string,
  primaryDomain: string,
): ShopifyProductWrite | null {
  const shopifyProductId = asId(product.id);
  const handle = asString(product.handle);
  const title = asString(product.title).trim();
  if (!shopifyProductId || !handle || !title) return null;
  const variants = (product.variants ?? []).map(mapVariant).filter((row): row is ShopifyVariantRecord => Boolean(row));
  const imageUrls = (product.images ?? [])
    .map((image) => asString(image.src).trim())
    .filter((src) => /^https?:\/\//i.test(src));
  return {
    workspaceId,
    shopifyProductId,
    handle,
    title,
    description: stripHtml(asString(product.body_html)),
    status: asString(product.status).toLowerCase() || "active",
    productType: asString(product.product_type),
    vendor: asString(product.vendor),
    tags: asString(product.tags),
    url: storefrontUrl(primaryDomain, handle),
    imageUrls,
    variants,
    publishedAt: product.published_at ? new Date(product.published_at) : null,
    shopifyUpdatedAt: product.updated_at ? new Date(product.updated_at) : null,
  };
}

export function assertProductsBelongToWorkspace(products: ShopifyProductRecord[], workspaceId: string) {
  return products.filter((row) => row.workspaceId === workspaceId);
}

export function publicCatalogProducts(products: ShopifyProductRecord[], workspaceId: string) {
  return assertProductsBelongToWorkspace(products, workspaceId).filter(
    (row) => row.status === "active" && Boolean(row.publishedAt || row.url),
  );
}

function parsePriceCap(question: string) {
  const match =
    question.match(/(?:under|below|less than|cheaper than)\s*\$?\s*([0-9]+(?:\.[0-9]+)?)/i) ||
    question.match(/\$\s*([0-9]+(?:\.[0-9]+)?)\s*(?:or less|and under|max)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function lowestPrice(product: ShopifyProductRecord) {
  const prices = product.variants
    .map((row) => Number(row.price))
    .filter((value) => Number.isFinite(value));
  return prices.length ? Math.min(...prices) : null;
}

function isCatalogBrowse(question: string) {
  return /\b(what (do you sell|watches|products)|which (watches|products)|show me (your )?(watches|products|catalog)|your catalog)\b/i.test(
    question,
  );
}

export function retrieveRelevantProducts(
  products: ShopifyProductRecord[],
  question: string,
  workspaceId: string,
  limit?: number,
) {
  const scoped = publicCatalogProducts(products, workspaceId);
  const tokens = tokenize(question);
  const cap = parsePriceCap(question);
  const max = limit ?? (isCatalogBrowse(question) ? 8 : 4);
  const scored = scoped
    .map((product) => {
      const hay = [
        product.title,
        product.description,
        product.productType,
        product.vendor,
        product.tags,
        product.handle,
        product.url,
        ...product.variants.map((row) => `${row.title} ${row.sku} ${row.price}`),
      ].join(" ");
      let score = 0;
      for (const token of tokens) {
        if (hay.toLowerCase().includes(token)) score += 1;
      }
      score += jaccard(question, hay) * 4;
      const price = lowestPrice(product);
      if (cap !== null) {
        if (price === null) return { product, score: 0 };
        if (price > cap) return { product, score: 0 };
        score += 2;
      }
      return { product, score };
    })
    .filter((row) => row.score > 0 || (isCatalogBrowse(question) && cap === null))
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title));

  const chosen: ShopifyProductRecord[] = [];
  for (const row of isCatalogBrowse(question) && cap === null ? scored : scored.filter((item) => item.score > 0)) {
    if (chosen.length >= max) break;
    if (chosen.some((item) => item.shopifyProductId === row.product.shopifyProductId)) continue;
    chosen.push(row.product);
  }
  return chosen;
}

function variantLine(variant: ShopifyVariantRecord) {
  const parts = [`Variant: ${variant.title}`, variant.price ? `price ${variant.price}` : null];
  if (variant.sku) parts.push(`SKU ${variant.sku}`);
  if (variant.compareAtPrice) parts.push(`Shopify compare-at price ${variant.compareAtPrice}`);
  if (variant.inventoryTracked && variant.inventoryQuantity !== null) {
    parts.push(`inventory quantity ${variant.inventoryQuantity}`);
    if (variant.available === true) parts.push("available according to Shopify");
    if (variant.available === false) parts.push("not available according to Shopify");
  } else {
    parts.push("inventory/availability not provided by Shopify for this variant");
  }
  return parts.filter(Boolean).join("; ");
}

export function shopifyCatalogPrompt(products: ShopifyProductRecord[]) {
  if (!products.length) {
    return "No connected Shopify catalog products are available for this subscriber.";
  }
  return products
    .map((product) => {
      const images = product.imageUrls.length ? `Images: ${product.imageUrls.slice(0, 4).join(", ")}` : "Images: none provided by Shopify";
      const variants = product.variants.length
        ? product.variants.map(variantLine).join("\n")
        : "Variants: none provided by Shopify";
      return [
        `Shopify product: ${product.title}`,
        `Status: ${product.status}`,
        product.url && `Product URL: ${product.url}`,
        product.productType && `Type: ${product.productType}`,
        product.vendor && `Vendor: ${product.vendor}`,
        product.tags && `Tags: ${product.tags}`,
        product.description && `Description: ${product.description.slice(0, 1800)}`,
        images,
        variants,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

export function groundedCatalogAnswer(input: {
  question: string;
  products: ShopifyProductRecord[];
  workspaceId: string;
}): { answer: string; usedCatalog: boolean; products: ShopifyProductRecord[] } {
  const relevant = retrieveRelevantProducts(input.products, input.question, input.workspaceId);
  if (!relevant.length) {
    return { answer: CATALOG_NO_SOURCE_ANSWER, usedCatalog: false, products: [] };
  }
  const lines = relevant.map((product) => {
    const prices = product.variants.map((row) => row.price).filter(Boolean);
    const price = prices.length ? prices.join(" / ") : "price not provided by Shopify";
    return `${product.title} — ${price}${product.url ? ` — ${product.url}` : ""}`;
  });
  return {
    answer: `From the connected Shopify catalog:\n${lines.join("\n")}`,
    usedCatalog: true,
    products: relevant,
  };
}

export function shopifyFactsForQuery(products: ShopifyProductRecord[], question: string, workspaceId: string) {
  return retrieveRelevantProducts(products, question, workspaceId, 4).map((product) => {
    const prices = product.variants.map((row) => row.price).filter(Boolean);
    const price = prices.length ? `Price ${prices.join(" / ")}.` : "Price not provided by Shopify.";
    return `Shopify catalog: ${product.title}. ${price}${product.url ? ` Link ${product.url}.` : ""} Status ${product.status}.`;
  });
}

function catalogPriceLabel(product: ShopifyProductRecord) {
  const amounts = product.variants
    .map((row) => Number(row.price))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (!amounts.length) return "";
  const format = (value: number) => `$${value.toFixed(2)}`;
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

function catalogDescriptionLabel(description: string) {
  const clean = description.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const sentences = clean.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [clean];
  let text = sentences
    .slice(0, 2)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
  if (text.length > 220) {
    const cut = text.slice(0, 220);
    const boundary = cut.lastIndexOf(" ");
    text = `${(boundary > 80 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
  }
  return text;
}

export function catalogProductSources(products: ShopifyProductRecord[]) {
  return products
    .filter((row) => row.url)
    .map((row) => {
      const price = catalogPriceLabel(row);
      const description = catalogDescriptionLabel(row.description);
      return {
        title: row.title,
        url: row.url,
        kind: "product" as const,
        ...(price ? { price } : {}),
        ...(description ? { description } : {}),
      };
    });
}
