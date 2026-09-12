export type GmailPayloadPart = {
  mimeType?: string;
  filename?: string;
  body?: { data?: string; size?: number };
  parts?: GmailPayloadPart[];
  headers?: { name?: string; value?: string }[];
};

export type GmailApiMessage = {
  id?: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPayloadPart;
};

function headerValue(payload: GmailPayloadPart | undefined, name: string) {
  const match = payload?.headers?.find((row) => row.name?.toLowerCase() === name.toLowerCase());
  return match?.value?.trim() || "";
}

export function parseFromHeader(value: string): { name: string; email: string } {
  const trimmed = value.trim();
  const angled = trimmed.match(/^(?:"?([^"<]*)"?\s*)?<([^>]+)>$/);
  if (angled) {
    const email = angled[2].trim();
    const name = angled[1].trim().replace(/^"|"$/g, "");
    return { name: name || email, email };
  }
  const emailOnly = trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  if (emailOnly) {
    return { name: trimmed, email: trimmed };
  }
  return { name: trimmed || "Unknown sender", email: "" };
}

export function decodeBase64Url(data: string) {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

export function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function collectBodies(payload: GmailPayloadPart | undefined, acc: { mime: string; text: string }[]) {
  if (!payload) return;
  if (payload.body?.data) {
    const mime = payload.mimeType || "text/plain";
    const text = decodeBase64Url(payload.body.data);
    acc.push({ mime, text });
  }
  for (const part of payload.parts ?? []) {
    collectBodies(part, acc);
  }
}

export function extractPlainBody(payload: GmailPayloadPart | undefined, snippet = "") {
  const bodies: { mime: string; text: string }[] = [];
  collectBodies(payload, bodies);
  const plain = bodies.find((row) => row.mime.toLowerCase().startsWith("text/plain"));
  if (plain?.text.trim()) return plain.text.trim();
  const html = bodies.find((row) => row.mime.toLowerCase().startsWith("text/html"));
  if (html?.text.trim()) return htmlToText(html.text);
  return snippet.trim();
}

export function messageIsUnread(labelIds: string[] | undefined) {
  return Boolean(labelIds?.includes("UNREAD"));
}

export function parseGmailDate(message: GmailApiMessage) {
  const header = headerValue(message.payload, "Date");
  if (header) {
    const parsed = new Date(header);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (message.internalDate) {
    const ms = Number(message.internalDate);
    if (Number.isFinite(ms)) return new Date(ms);
  }
  return new Date();
}

export function summarizeGmailMessage(message: GmailApiMessage, includeBody: boolean) {
  const from = parseFromHeader(headerValue(message.payload, "From"));
  const subject = headerValue(message.payload, "Subject") || "(no subject)";
  const rfcMessageId = headerValue(message.payload, "Message-ID") || headerValue(message.payload, "Message-Id");
  const date = parseGmailDate(message);
  const snippet = (message.snippet || "").trim();
  return {
    id: message.id || "",
    threadId: message.threadId || "",
    fromName: from.name,
    fromEmail: from.email,
    subject,
    snippet,
    body: includeBody ? extractPlainBody(message.payload, snippet) : snippet,
    date: date.toISOString(),
    unread: messageIsUnread(message.labelIds),
    rfcMessageId: rfcMessageId || null,
  };
}
