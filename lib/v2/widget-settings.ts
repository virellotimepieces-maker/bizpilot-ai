import { isOneOf, WIDGET_POSITIONS, type WidgetPosition } from "./enums";
import type { WidgetSettingsInput, WidgetSettingsRecord } from "./types";

export const DEFAULT_WIDGET_WELCOME =
  "Hi — I’m the AI assistant for this business. I can help with questions from the business knowledge base. For anything I cannot verify, I can pass it to the team.";

export const DEFAULT_AI_IDENTIFICATION = "AI assistant";

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
