function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function metaContent(html: string, name: string) {
  const named = html.match(
    new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, "i"),
  )?.[1];
  if (named) return named.trim();
  return (
    html
      .match(
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"),
      )?.[1]
      ?.trim() ?? ""
  );
}

function jsonLdText(html: string) {
  const blocks = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ];
  const parts: string[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1] ?? "") as unknown;
      const stack = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of stack) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        for (const key of ["name", "headline", "description"]) {
          const value = record[key];
          if (typeof value === "string" && value.trim()) parts.push(value.trim());
        }
      }
    } catch {
      const raw = (block[1] ?? "").replace(/<[^>]+>/g, " ").trim();
      if (raw) parts.push(raw);
    }
  }
  return parts.join(" ");
}

function visibleHtml(html: string) {
  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? html;
  return main
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

export function extractPageText(html: string) {
  const title =
    html
      .match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .trim() ?? "";
  const description = metaContent(html, "description") || metaContent(html, "og:description");
  const text = decodeEntities(`${description} ${jsonLdText(html)} ${visibleHtml(html)}`)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12000);
  return { title: decodeEntities(title).replace(/\s+/g, " ").trim(), text };
}

export function hashText(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return `h${Math.abs(hash).toString(16)}`;
}
