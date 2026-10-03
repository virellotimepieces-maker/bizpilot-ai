export const WIDGET_CHROME_EN = {
  assistantFor: "AI assistant for {business}",
  assistant: "AI assistant",
  chat: "Chat",
  teammateWillReply: "A teammate will reply here",
  leaveContact: "Leave your name and email (optional)",
  hideContact: "Hide contact details",
  talkToPerson: "Talk to a person",
  askQuestion: "Ask a question",
  send: "Send",
  sending: "Sending…",
  name: "Name",
  email: "Email",
  phone: "Phone",
  saveContact: "Save contact",
  saving: "Saving…",
  openChat: "Open chat",
  closeChat: "Close chat",
  message: "Message",
  lookingUp: "Looking that up…",
  viewProduct: "View Product",
  showMore: "Show {count} more",
  team: "Team",
  saveContactError: "Could not save your contact details.",
  answerError: "The live widget could not answer.",
  reachError: "The live widget could not be reached.",
  teammateError: "Could not reach a teammate.",
  answerNowError: "I could not answer just now.",
} as const;

export type WidgetChromeKey = keyof typeof WIDGET_CHROME_EN;
export type WidgetChrome = Record<WidgetChromeKey, string>;

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur"]);

export function widgetLanguageBase(language: string) {
  return language.trim().toLowerCase().split(/[_-]/)[0] ?? "";
}

export function widgetTextDirection(language: string): "ltr" | "rtl" {
  return RTL_LANGUAGES.has(widgetLanguageBase(language)) ? "rtl" : "ltr";
}

export function fillWidgetChrome(template: string, values: { business?: string; count?: string }) {
  return template.replace(/\{(business|count)\}/g, (token, key: "business" | "count") => values[key] ?? token);
}

const VISIBLE_CHROME_KEYS: WidgetChromeKey[] = [
  "assistantFor",
  "leaveContact",
  "talkToPerson",
  "askQuestion",
  "send",
];

export function chromeFromPayload(chrome: Partial<WidgetChrome> | null | undefined): WidgetChrome {
  const next: WidgetChrome = { ...WIDGET_CHROME_EN };
  if (!chrome) return next;
  for (const key of Object.keys(WIDGET_CHROME_EN) as WidgetChromeKey[]) {
    const value = chrome[key];
    if (typeof value === "string" && value.trim()) next[key] = value.trim();
  }
  return next;
}

export function widgetChromeIsLocalized(chrome: WidgetChrome) {
  return VISIBLE_CHROME_KEYS.some((key) => chrome[key] !== WIDGET_CHROME_EN[key]);
}

export function applyWidgetChromeState(
  current: { language: string; chrome: WidgetChrome },
  payload: { detectedLanguage?: string; chrome?: Partial<WidgetChrome> | null },
) {
  const language = payload.detectedLanguage?.trim() || current.language || "en";
  if (!payload.chrome) return { language, chrome: current.chrome };
  const incoming = chromeFromPayload(payload.chrome);
  const base = widgetLanguageBase(language);
  if (base && base !== "en" && widgetChromeIsLocalized(current.chrome) && !widgetChromeIsLocalized(incoming)) {
    return { language, chrome: current.chrome };
  }
  return { language, chrome: incoming };
}
