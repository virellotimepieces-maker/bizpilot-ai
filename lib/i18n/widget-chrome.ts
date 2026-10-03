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
