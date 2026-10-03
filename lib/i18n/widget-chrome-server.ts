import type { BillingStore } from "@/lib/billing/store";
import { isEnglishLanguage, languageName } from "@/lib/i18n/localize";
import type { TranslateFn } from "@/lib/i18n/localize";
import { WIDGET_CHROME_EN, widgetLanguageBase, type WidgetChrome, type WidgetChromeKey } from "@/lib/i18n/widget-chrome";

const CHROME_KEYS = Object.keys(WIDGET_CHROME_EN) as WidgetChromeKey[];
const chromeCache = new Map<string, WidgetChrome>();

export async function localizeWidgetChrome(language: string, translate?: TranslateFn): Promise<WidgetChrome> {
  if (isEnglishLanguage(language)) return { ...WIDGET_CHROME_EN };
  const code = widgetLanguageBase(language) || language.trim();
  if (!translate) {
    const cached = chromeCache.get(code);
    if (cached) return cached;
  }
  try {
    const translated = translate ? await translateFields(code, translate) : await translateBundle(code);
    const safe = acceptChrome(translated);
    if (!safe) return { ...WIDGET_CHROME_EN };
    if (!translate) chromeCache.set(code, safe);
    return safe;
  } catch {
    return { ...WIDGET_CHROME_EN };
  }
}

export async function widgetChromeForConversation(
  store: BillingStore,
  widgetKey: string,
  conversationId: string | undefined,
  translate?: TranslateFn,
) {
  const english = { detectedLanguage: "en", chrome: { ...WIDGET_CHROME_EN } };
  if (!conversationId) return english;
  const workspace = await store.getWorkspaceByWidgetKey(widgetKey);
  if (!workspace) return english;
  const conversation = await store.getConversation(conversationId, workspace.id);
  const language = conversation?.detectedLanguage || "en";
  return {
    detectedLanguage: isEnglishLanguage(language) ? "en" : widgetLanguageBase(language) || language,
    chrome: await localizeWidgetChrome(language, translate),
  };
}

async function translateFields(language: string, translate: TranslateFn): Promise<WidgetChrome> {
  const entries = await Promise.all(
    CHROME_KEYS.map(async (key) => [key, (await translate(WIDGET_CHROME_EN[key], language)).trim()] as const),
  );
  return Object.fromEntries(entries) as WidgetChrome;
}

async function translateBundle(language: string): Promise<WidgetChrome> {
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
            `Translate each JSON string value into ${name} (${language}).`,
            "Return only JSON with the same keys.",
            "Keep placeholders {business} and {count} exactly.",
            "Do not translate names, emails, URLs, prices, dates, or product data.",
            "Do not add or remove keys.",
          ].join(" "),
        },
        { role: "user", content: JSON.stringify(WIDGET_CHROME_EN) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`translation_http_${response.status}`);
  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("translation_empty");
  return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")) as WidgetChrome;
}

function acceptChrome(value: unknown): WidgetChrome | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const next = {} as WidgetChrome;
  for (const key of CHROME_KEYS) {
    const translated = record[key];
    if (typeof translated !== "string" || !translated.trim()) return null;
    if (placeholders(WIDGET_CHROME_EN[key]) !== placeholders(translated)) return null;
    next[key] = translated.trim();
  }
  return next;
}

function placeholders(text: string) {
  return [...text.matchAll(/\{[a-z]+\}/g)].map((match) => match[0]).sort().join(",");
}
