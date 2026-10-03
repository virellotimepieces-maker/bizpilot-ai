export const WIDGET_PRODUCT_PREVIEW_LIMIT = 4;

export type WidgetProductCard = {
  name: string;
  price: string | null;
  description: string | null;
  href: string | null;
  imageUrl: string | null;
};

export type WidgetMessageView = {
  prose: string;
  products: WidgetProductCard[];
};

const PRICE_LABEL = /^\$\d{1,7}\.\d{2}(?: – \$\d{1,7}\.\d{2})?$/;

function plainText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const PRODUCT_MARKDOWN_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]*\/products\/[^)\s]+)\)/gi;

export function productLinkKey(url: string) {
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, "").toLowerCase();
    if (!path.includes("/products/")) return "";
    return `${host}${path}`;
  } catch {
    return "";
  }
}

export function stripMarkdownMarkers(value: string) {
  return value
    .replace(PRODUCT_MARKDOWN_LINK, " ")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/[^)\s]+)\)/gi, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?;:])/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1");
}

export function safeProductHref(value: string) {
  const raw = value.trim();
  if (!raw || /[\u0000-\u001F\u007F\s]/.test(raw)) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    if (!parsed.hostname || parsed.hostname === "localhost") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function priceLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return PRICE_LABEL.test(trimmed) ? trimmed : null;
}

function descriptionLabel(value: unknown) {
  if (typeof value !== "string") return null;
  const text = plainText(stripMarkdownMarkers(value));
  if (!text) return null;
  return text.length > 220 ? `${text.slice(0, 217).trimEnd()}…` : text;
}

function contentProductKeys(content: string) {
  const keys = new Set<string>();
  for (const match of content.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)) {
    const key = productLinkKey(match[0]);
    if (key) keys.add(key);
  }
  return keys;
}

export function productCardsFromSources(sources: unknown, content = ""): WidgetProductCard[] {
  if (!Array.isArray(sources)) return [];
  const cards: WidgetProductCard[] = [];
  const seen = new Set<string>();
  const haystack = content.toLowerCase();
  const linked = contentProductKeys(content);
  for (const row of sources) {
    if (!row || typeof row !== "object") continue;
    const item = row as {
      title?: unknown;
      url?: unknown;
      kind?: unknown;
      price?: unknown;
      description?: unknown;
      imageUrl?: unknown;
    };
    if (item.kind !== "product" || typeof item.title !== "string") continue;
    const name = plainText(stripMarkdownMarkers(item.title)).slice(0, 140);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    const href = typeof item.url === "string" ? safeProductHref(item.url) : null;
    const linkKey = typeof item.url === "string" ? productLinkKey(item.url) : "";
    const mentioned =
      !content.trim() ||
      haystack.includes(key) ||
      (linkKey ? linked.has(linkKey) : false) ||
      (href ? content.includes(href) : false);
    if (!mentioned) continue;
    seen.add(key);
    cards.push({
      name,
      price: priceLabel(item.price),
      description: descriptionLabel(item.description),
      href,
      imageUrl: safeProductHref(typeof item.imageUrl === "string" ? item.imageUrl : ""),
    });
  }
  return cards;
}

function hideProductUrls(text: string, products: WidgetProductCard[]) {
  let next = text;
  for (const product of products) {
    if (product.href) next = next.split(product.href).join(" ");
  }
  return next.replace(/https?:\/\/[^\s<>"')]+\/products\/[^\s<>"')]+/gi, " ");
}

const POINTER_WORDS = new Set([
  "a",
  "an",
  "the",
  "you",
  "can",
  "could",
  "explore",
  "more",
  "about",
  "it",
  "here",
  "link",
  "this",
  "view",
  "product",
  "click",
  "learn",
  "see",
  "find",
  "check",
  "out",
  "details",
  "info",
  "information",
  "read",
  "our",
  "page",
  "website",
]);

function isBarePointer(sentence: string) {
  const text = sentence
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[^a-z0-9\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return true;
  const words = text.split(" ").filter(Boolean);
  return words.length > 0 && words.every((word) => POINTER_WORDS.has(word.toLowerCase()));
}

function isProductDumpSentence(sentence: string, products: WidgetProductCard[]) {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const named = products.some((product) => lower.includes(product.name.toLowerCase()));
  if (!named) return false;
  if (/https?:\/\//i.test(trimmed)) return true;
  if (/\$\s?\d/.test(trimmed)) return true;
  const withoutNames = products.reduce(
    (value, product) => value.replace(new RegExp(product.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " "),
    trimmed,
  );
  const words = withoutNames.replace(/[^a-z0-9\s]/gi, " ").split(/\s+/).filter(Boolean);
  return words.length < 3;
}

function presentSentence(sentence: string, products: WidgetProductCard[]) {
  return hideProductUrls(stripMarkdownMarkers(sentence), products)
    .replace(/\s+([.!?])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function visibleAssistantProse(content: string, products: WidgetProductCard[]) {
  const kept = content
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) =>
      line
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => {
          const cleaned = presentSentence(sentence, products);
          const hadProductLink = /\/products\//i.test(sentence);
          if (!cleaned) return "";
          if (hadProductLink && isBarePointer(cleaned)) return "";
          if (products.length && isProductDumpSentence(cleaned, products)) return "";
          return cleaned;
        })
        .filter(Boolean)
        .join(" ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return kept;
}

export function presentAssistantMessage(content: string, sources: unknown): WidgetMessageView {
  const products = productCardsFromSources(sources, content);
  return {
    prose: visibleAssistantProse(content, products),
    products,
  };
}

export function visibleProductCards(products: WidgetProductCard[], expanded: boolean) {
  if (expanded) return products;
  return products.slice(0, WIDGET_PRODUCT_PREVIEW_LIMIT);
}
