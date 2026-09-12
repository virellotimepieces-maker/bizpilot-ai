export function customerFirstName(name?: string) {
  const raw = name?.trim() ?? "";
  if (!raw || raw.includes("@")) return "there";
  const first = raw.split(/\s+/)[0]?.replace(/[^\p{L}\p{M}'-]/gu, "") ?? "";
  return first || "there";
}

export function unwrapEmailBody(body: string) {
  let text = body.trim();
  text = text.replace(/^```(?:[a-z]+)?\s*/i, "").replace(/\s*```$/i, "");
  const hi = text.search(/^Hi\s+/m);
  if (hi > 0) text = text.slice(hi);
  text = text.replace(/^Hi\s+[^,\n]+,\s*/i, "");
  text = text.replace(
    /\n(?:Best regards|Kind regards|Warm regards|Sincerely)\s*,?\s*\n[\s\S]*$/i,
    "",
  );
  text = text.replace(/\n—\s+.+\s*$/i, "");
  text = text.replace(/\n*If you need anything else[\s\S]*$/i, "");
  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function formatFinishedEmail(input: {
  firstName: string;
  closing: string;
  body: string;
  businessName?: string;
}) {
  const inner = unwrapEmailBody(input.body);
  const closing = input.closing.trim() || input.businessName?.trim() || "";
  if (!closing) {
    return `Hi ${input.firstName},\n\n${inner}`;
  }
  return `Hi ${input.firstName},\n\n${inner}\n\nBest regards,\n${closing}`;
}
