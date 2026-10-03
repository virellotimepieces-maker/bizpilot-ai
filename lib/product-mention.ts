function normalizeProductText(value: string) {
  return value
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasPhrase(content: string, phrase: string) {
  if (!phrase) return false;
  return ` ${content} `.includes(` ${phrase} `);
}

function titleLead(title: string) {
  return normalizeProductText(title.split(/[:–—-]/)[0] ?? title);
}

function modelCodes(title: string) {
  return normalizeProductText(title)
    .split(" ")
    .filter((token) => /^[a-z]{2,}\d{2,}[a-z0-9]*$/.test(token) && !/^\d+mm$/.test(token));
}

/** Higher scores are closer name matches. Zero means the reply does not name this product. */
export function productTitleScore(title: string, content: string) {
  const name = normalizeProductText(title);
  const haystack = normalizeProductText(content);
  if (!name || !haystack) return 0;
  if (hasPhrase(haystack, name)) return 100 + name.length;
  const lead = titleLead(title);
  if (lead.length >= 8 && lead !== name && hasPhrase(haystack, lead)) return 80 + lead.length;
  if (modelCodes(name).some((code) => hasPhrase(haystack, code))) return 70;
  return 0;
}
