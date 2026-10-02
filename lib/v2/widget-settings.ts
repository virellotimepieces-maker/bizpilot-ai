import { BillingError } from "@/lib/billing/types";
import { requireWidgetPosition } from "./assert";
import { isOneOf, WIDGET_POSITIONS, type WidgetPosition } from "./enums";
import type { WidgetSettingsInput, WidgetSettingsRecord } from "./types";

export const DEFAULT_WIDGET_WELCOME =
  "Hi — I’m the AI assistant for this business. I can help with questions from the business knowledge base. For anything I cannot verify, I can pass it to the team.";

export const DEFAULT_AI_IDENTIFICATION = "AI assistant";

/** V2 indigo. Empty stored accentColor resolves to this — never teal. */
export const DEFAULT_WIDGET_ACCENT = "#3d4eb8";

export const MAX_SUGGESTED_QUESTIONS = 6;
export const MAX_SUGGESTED_QUESTION_LENGTH = 100;
export const MAX_WELCOME_LENGTH = 600;
export const MAX_DISPLAY_NAME_LENGTH = 80;
export const MAX_PLACEHOLDER_LENGTH = 80;
export const MAX_LOGO_URL_LENGTH = 500;

export function defaultSuggestedQuestions() {
  return [
    "What do you offer?",
    "What are your hours?",
    "How do I get a quote?",
  ];
}

export function parseWidgetPosition(value: string | null | undefined): WidgetPosition {
  if (value && isOneOf(value, WIDGET_POSITIONS)) return value;
  return "bottom-right";
}

export function looksLikeEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function parseAccentColor(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed)) return trimmed.toLowerCase();
  throw new BillingError("Accent color must be a hex value like #3d4eb8.", "invalid");
}

export function resolvedAccentColor(value: string | null | undefined): string {
  try {
    const parsed = parseAccentColor(value);
    return parsed || DEFAULT_WIDGET_ACCENT;
  } catch {
    return DEFAULT_WIDGET_ACCENT;
  }
}

export function sanitizeLogoUrl(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.length > MAX_LOGO_URL_LENGTH) {
    throw new BillingError("Logo URL is too long.", "invalid");
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new BillingError("Logo URL must start with http:// or https://.", "invalid");
    }
    return url.toString();
  } catch (error) {
    if (error instanceof BillingError) throw error;
    throw new BillingError("Enter a valid logo URL.", "invalid");
  }
}

export function normalizeSuggestedQuestions(value: unknown): string[] {
  const rows = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split("\n")
      : [];
  const next = rows
    .map((row) => String(row).trim())
    .filter(Boolean)
    .slice(0, MAX_SUGGESTED_QUESTIONS)
    .map((row) => row.slice(0, MAX_SUGGESTED_QUESTION_LENGTH));
  return next;
}

export function suggestedQuestionsText(questions: string[]) {
  return questions.join("\n");
}

export function defaultWidgetSettings(
  workspaceId: string,
  now = new Date(),
): Omit<WidgetSettingsRecord, "id"> {
  return {
    workspaceId,
    businessDisplayName: "",
    logoUrl: "",
    welcomeMessage: DEFAULT_WIDGET_WELCOME,
    suggestedQuestions: defaultSuggestedQuestions(),
    accentColor: "",
    position: "bottom-right",
    identifyAsAi: true,
    collectPhone: false,
    leadCaptureEnabled: true,
    placeholderPrompt: "Ask a question",
    createdAt: now,
    updatedAt: now,
  };
}

export function mergeWidgetSettings(
  current: WidgetSettingsRecord,
  patch: WidgetSettingsInput,
): WidgetSettingsRecord {
  return {
    ...current,
    businessDisplayName: patch.businessDisplayName ?? current.businessDisplayName,
    logoUrl: patch.logoUrl ?? current.logoUrl,
    welcomeMessage: patch.welcomeMessage ?? current.welcomeMessage,
    suggestedQuestions: patch.suggestedQuestions ?? current.suggestedQuestions,
    accentColor: patch.accentColor ?? current.accentColor,
    position: patch.position ?? current.position,
    identifyAsAi: patch.identifyAsAi ?? current.identifyAsAi,
    collectPhone: patch.collectPhone ?? current.collectPhone,
    leadCaptureEnabled: patch.leadCaptureEnabled ?? current.leadCaptureEnabled,
    placeholderPrompt: patch.placeholderPrompt ?? current.placeholderPrompt,
    updatedAt: new Date(),
  };
}

export type PublicWidgetAppearance = {
  businessDisplayName: string;
  logoUrl: string;
  welcomeMessage: string;
  suggestedQuestions: string[];
  accentColor: string;
  position: WidgetPosition;
  identifyAsAi: boolean;
  collectPhone: boolean;
  leadCaptureEnabled: boolean;
  placeholderPrompt: string;
};

export function publicWidgetAppearance(
  settings: WidgetSettingsRecord | null,
  workspaceName = "",
): PublicWidgetAppearance {
  const base = settings ?? {
    id: "default",
    ...defaultWidgetSettings("public"),
  };
  let logoUrl = "";
  try {
    logoUrl = sanitizeLogoUrl(base.logoUrl);
  } catch {
    logoUrl = "";
  }
  const name = base.businessDisplayName.trim() || workspaceName.trim();
  return {
    businessDisplayName: name.slice(0, MAX_DISPLAY_NAME_LENGTH),
    logoUrl,
    welcomeMessage: base.welcomeMessage.trim() || DEFAULT_WIDGET_WELCOME,
    suggestedQuestions: normalizeSuggestedQuestions(base.suggestedQuestions),
    accentColor: resolvedAccentColor(base.accentColor),
    position: parseWidgetPosition(base.position),
    identifyAsAi: base.identifyAsAi,
    collectPhone: base.collectPhone,
    leadCaptureEnabled: base.leadCaptureEnabled,
    placeholderPrompt: base.placeholderPrompt.trim() || "Ask a question",
  };
}

export function serializeWidgetSettings(row: WidgetSettingsRecord) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    businessDisplayName: row.businessDisplayName,
    logoUrl: row.logoUrl,
    welcomeMessage: row.welcomeMessage,
    suggestedQuestions: row.suggestedQuestions,
    accentColor: row.accentColor,
    position: row.position,
    identifyAsAi: row.identifyAsAi,
    collectPhone: row.collectPhone,
    leadCaptureEnabled: row.leadCaptureEnabled,
    placeholderPrompt: row.placeholderPrompt,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type SerializedWidgetSettings = ReturnType<typeof serializeWidgetSettings>;

function asBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function parseWidgetSettingsInput(body: unknown): WidgetSettingsInput {
  if (!body || typeof body !== "object") {
    throw new BillingError("Widget settings are required.", "invalid");
  }
  const row = body as Record<string, unknown>;
  const patch: WidgetSettingsInput = {};
  if ("businessDisplayName" in row) {
    patch.businessDisplayName = asString(row.businessDisplayName).trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
  }
  if ("logoUrl" in row) {
    patch.logoUrl = asString(row.logoUrl).trim() ? sanitizeLogoUrl(asString(row.logoUrl)) : "";
  }
  if ("welcomeMessage" in row) {
    const welcome = asString(row.welcomeMessage).trim();
    if (!welcome) throw new BillingError("Welcome message is required.", "invalid");
    patch.welcomeMessage = welcome.slice(0, MAX_WELCOME_LENGTH);
  }
  if ("suggestedQuestions" in row) {
    patch.suggestedQuestions = normalizeSuggestedQuestions(row.suggestedQuestions);
  }
  if ("accentColor" in row) {
    patch.accentColor = parseAccentColor(asString(row.accentColor));
  }
  if ("position" in row) {
    patch.position = requireWidgetPosition(asString(row.position, "bottom-right"));
  }
  if ("identifyAsAi" in row) {
    patch.identifyAsAi = asBoolean(row.identifyAsAi, true);
  }
  if ("collectPhone" in row) {
    patch.collectPhone = asBoolean(row.collectPhone, false);
  }
  if ("leadCaptureEnabled" in row) {
    patch.leadCaptureEnabled = asBoolean(row.leadCaptureEnabled, true);
  }
  if ("placeholderPrompt" in row) {
    const placeholder = asString(row.placeholderPrompt).trim();
    patch.placeholderPrompt = (placeholder || "Ask a question").slice(0, MAX_PLACEHOLDER_LENGTH);
  }
  if (patch.collectPhone && patch.leadCaptureEnabled === false) {
    patch.collectPhone = false;
  }
  return patch;
}
