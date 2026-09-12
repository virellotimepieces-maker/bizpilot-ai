export type GmailThreadSplit = {
  /** Newest sender text shown in the Email UI and answered by the AI. */
  latest: string;
  /** Quoted Gmail history kept for context. Empty when there is no prior thread. */
  quoted: string;
};

const ON_WROTE_SAME_LINE = /^On .+wrote:\s*$/i;
const ORIGINAL_MESSAGE = /^-{2,}\s*Original Message\s*-{2,}\s*$/i;
const ORIGINAL_MESSAGE_PLAIN = /^Original Message\s*$/i;
const FORWARDED_BANNER =
  /^(?:[-–—_*]{2,}\s*)?(?:Begin\s+)?Forwarded(?:\s+Message)?\s*:?(?:\s*[-–—_*]{2,})?\s*$/i;
const UNDERSCORE_RULE = /^_{5,}$/;
const QUOTE_PREFIX = /^>/;

function nonempty(lines: string[]) {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function remainderLooksQuoted(lines: string[], start: number) {
  const rows = nonempty(lines.slice(start));
  if (!rows.length) return false;
  if (rows.every((line) => QUOTE_PREFIX.test(line))) return true;
  const quotedish = rows.filter(
    (line) =>
      QUOTE_PREFIX.test(line) ||
      ON_WROTE_SAME_LINE.test(line) ||
      /^wrote:\s*$/i.test(line) ||
      ORIGINAL_MESSAGE.test(line) ||
      FORWARDED_BANNER.test(line),
  ).length;
  return quotedish / rows.length >= 0.6;
}

function isOnWroteStart(lines: string[], index: number) {
  const current = lines[index]?.trim() ?? "";
  if (ON_WROTE_SAME_LINE.test(current)) return true;
  if (!/^On\s+\S/.test(current)) return false;
  const parts = [current];
  for (let offset = 1; offset <= 2; offset += 1) {
    const next = lines[index + offset]?.trim() ?? "";
    if (!next || QUOTE_PREFIX.test(next)) break;
    parts.push(next);
    if (ON_WROTE_SAME_LINE.test(parts.join(" "))) return true;
  }
  return false;
}

function isHistoryBanner(text: string) {
  const trimmed = text.trim();
  return (
    FORWARDED_BANNER.test(trimmed) ||
    ORIGINAL_MESSAGE.test(trimmed) ||
    ORIGINAL_MESSAGE_PLAIN.test(trimmed)
  );
}

function isOutlookHeaderStart(lines: string[], index: number) {
  if (!/^From:\s.+/i.test(lines[index]?.trim() ?? "")) return false;
  const window = lines.slice(index, index + 8).join("\n");
  return /^(Sent|Date):/im.test(window) && /^(To|Subject):/im.test(window);
}

function isQuoteBoundary(lines: string[], index: number, hasLatest: boolean) {
  if (!hasLatest) return false;
  const trimmed = lines[index]?.trim() ?? "";
  if (isOnWroteStart(lines, index)) return true;
  if (ORIGINAL_MESSAGE.test(trimmed) || ORIGINAL_MESSAGE_PLAIN.test(trimmed)) return true;
  if (FORWARDED_BANNER.test(trimmed)) return true;
  if (UNDERSCORE_RULE.test(trimmed)) return true;
  if (isOutlookHeaderStart(lines, index)) return true;
  if (QUOTE_PREFIX.test(lines[index] ?? "") && remainderLooksQuoted(lines, index)) return true;
  return false;
}

/**
 * Splits a Gmail body into the newest message and quoted history.
 * Does not mutate stored Gmail or draft data — callers keep the original body.
 */
export function splitGmailThread(body: string): GmailThreadSplit {
  const normalized = body.replace(/\r\n/g, "\n");
  if (!normalized.trim()) return { latest: "", quoted: "" };

  const lines = normalized.split("\n");
  let quoteAt = -1;
  let hasLatest = false;

  for (let i = 0; i < lines.length; i += 1) {
    if (isQuoteBoundary(lines, i, hasLatest)) {
      quoteAt = i;
      break;
    }
    if (lines[i].trim()) hasLatest = true;
  }

  if (quoteAt < 0) {
    return { latest: normalized.trim(), quoted: "" };
  }

  const latest = lines.slice(0, quoteAt).join("\n").trim();
  const quoted = lines.slice(quoteAt).join("\n").trim();
  if (!latest || isHistoryBanner(latest)) {
    return { latest: normalized.trim(), quoted: "" };
  }
  return { latest, quoted };
}

export function latestGmailMessage(body: string) {
  return splitGmailThread(body).latest;
}
