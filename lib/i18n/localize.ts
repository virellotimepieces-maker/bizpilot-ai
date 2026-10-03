const LANGUAGE_NAMES: Record<string, string> = {
  tl: "Tagalog",
  fil: "Filipino",
  es: "Spanish",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ar: "Arabic",
  ru: "Russian",
  th: "Thai",
};

export type TranslateFn = (text: string, language: string) => Promise<string>;

export function languageName(code: string) {
  const base = code.trim().toLowerCase().split(/[_-]/)[0] ?? "";
  return LANGUAGE_NAMES[base] ?? code.trim();
}

export function isEnglishLanguage(language: string) {
  const base = language.trim().toLowerCase().split(/[_-]/)[0] ?? "";
  return !base || base === "en";
}

export async function localizeAssistantText(text: string, language: string, translate?: TranslateFn) {
  if (isEnglishLanguage(language)) return text;
  const code = language.trim().toLowerCase().split(/[_-]/)[0] || language.trim();
  try {
    const translated = (await (translate ?? translateWithModel)(text, code)).trim();
    if (!translated || !factsPreserved(text, translated)) return text;
    return translated;
  } catch {
    return text;
  }
}

export async function translateWithModel(text: string, language: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("no_translation_key");
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const name = languageName(language);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: [
            `Translate this assistant message into ${name} (${language}).`,
            "Preserve emails, URLs, phone numbers, dates, clock times, timezone names, durations, prices, product names, business names, personal names, and slot labels such as \"Mon, Oct 5, 10:30 AM\" exactly.",
            "Keep Date, Time, Timezone, Duration, and Reason values character for character.",
            "Do not add, remove, or change facts.",
            "Return only the translation.",
          ].join(" "),
        },
        { role: "user", content: text },
      ],
    }),
  });
  if (!response.ok) throw new Error(`translation_http_${response.status}`);
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const translated = payload.choices?.[0]?.message?.content?.trim();
  if (!translated) throw new Error("translation_empty");
  return translated;
}

function factsPreserved(source: string, translated: string) {
  const required = new Set<string>();
  for (const match of source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []) required.add(match);
  for (const match of source.match(/https?:\/\/\S+/gi) ?? []) required.add(match.replace(/[),.;]+$/, ""));
  for (const match of source.match(/\+\d[\d\s().-]{6,}\d/g) ?? []) required.add(match);
  for (const match of source.match(/\b[A-Za-z]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?\b/g) ?? []) required.add(match);
  for (const match of source.match(/\b\d{1,2}:\d{2}\b/g) ?? []) required.add(match);
  for (const match of source.match(
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), [A-Z][a-z]{2,8} \d{1,2}, \d{1,2}:\d{2} [AP]M\b/g,
  ) ?? []) {
    required.add(match);
  }
  for (const match of source.matchAll(/^(?:Date|Time|Timezone|Duration|Reason): (.+)$/gm)) {
    if (match[1]) required.add(match[1]);
  }
  const greeting = source.match(/^Hi ([^,]+),/m);
  if (greeting?.[1]) required.add(greeting[1]);
  const business = source.match(/Your appointment with (.+) is confirmed\./);
  if (business?.[1]) required.add(business[1]);
  for (const fact of required) {
    if (!translated.includes(fact)) return false;
  }
  return true;
}
