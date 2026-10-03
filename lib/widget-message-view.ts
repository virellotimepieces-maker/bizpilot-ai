export const WIDGET_PRODUCT_PREVIEW_LIMIT = 4;

export type WidgetProductCard = {
  name: string;
  price: string | null;
  description: string | null;
  href: string | null;
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

export function stripMarkdownMarkers(value: string) {
  return value
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

export function productCardsFromSources(sources: unknown, content = ""): WidgetProductCard[] {
  if (!Array.isArray(sources)) return [];
  const cards: WidgetProductCard[] = [];
  const seen = new Set<string>();
  const haystack = content.toLowerCase();
  for (const row of sources) {
    if (!row || typeof row !== "object") continue;
    const item = row as { title?: unknown; url?: unknown; kind?: unknown; price?: unknown; description?: unknown };
    if (item.kind !== "product" || typeof item.title !== "string") continue;
    const name = plainText(stripMarkdownMarkers(item.title)).slice(0, 140);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    const href = typeof item.url === "string" ? safeProductHref(item.url) : null;
    const mentioned =
      !content.trim() ||
      haystack.includes(key) ||
      (href ? content.includes(href) : false);
    if (!mentioned) continue;
    seen.add(key);
    cards.push({
      name,
      price: priceLabel(item.price),
      description: descriptionLabel(item.description),
      href,
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

export function visibleAssistantProse(content: string, products: WidgetProductCard[]) {
  const cleaned = hideProductUrls(stripMarkdownMarkers(content), products).replace(/\r\n/g, "\n");
  if (!products.length) {
    return cleaned.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  }
  const kept = cleaned
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .filter((sentence) => !isProductDumpSentence(sentence, products))
    .join(" ")
    .replace(/\s+/g, " ")
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
