"use client";

import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { HELPER_TEXT_CLASS, LABEL_CLASS } from "@/lib/ui/type-scale";
import { WIDGET_POSITIONS, type WidgetPosition } from "@/lib/v2/enums";
import {
  DEFAULT_WIDGET_ACCENT,
  MAX_SUGGESTED_QUESTIONS,
  suggestedQuestionsText,
  type SerializedWidgetSettings,
} from "@/lib/v2/widget-settings";

export type AppearanceDraft = Omit<SerializedWidgetSettings, "createdAt" | "updatedAt" | "id" | "workspaceId">;

export function appearanceDraftFromSettings(settings: SerializedWidgetSettings): AppearanceDraft {
  return {
    businessDisplayName: settings.businessDisplayName,
    logoUrl: settings.logoUrl,
    welcomeMessage: settings.welcomeMessage,
    suggestedQuestions: settings.suggestedQuestions,
    accentColor: settings.accentColor,
    position: settings.position,
    identifyAsAi: settings.identifyAsAi,
    collectPhone: settings.collectPhone,
    leadCaptureEnabled: settings.leadCaptureEnabled,
    placeholderPrompt: settings.placeholderPrompt,
  };
}

function positionLabel(position: WidgetPosition) {
  return position === "bottom-left" ? "Bottom left" : "Bottom right";
}

export function WidgetAppearanceForm({
  draft,
  onChange,
  onSave,
  saving,
  saveLabel,
  disabled,
  error,
}: {
  draft: AppearanceDraft;
  onChange: (next: AppearanceDraft) => void;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
  disabled: boolean;
  error: string | null;
}) {
  const accentPreview = draft.accentColor.trim() || DEFAULT_WIDGET_ACCENT;

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <p className={HELPER_TEXT_CLASS}>
        These settings change the live website widget. They do not change the $29 BizPilot Pro
        price, Stripe, or Gmail. Contact details a visitor leaves are stored on that conversation
        only — this screen does not create a Leads list.
      </p>
      <Field
        label="Business name in the chat"
        hint="Shown in the widget header. Leave blank to use your workspace name."
        htmlFor="widget-display-name"
      >
        <Input
          id="widget-display-name"
          value={draft.businessDisplayName}
          onChange={(event) => onChange({ ...draft, businessDisplayName: event.target.value })}
          placeholder="Harbor Outfitters"
        />
      </Field>
      <Field
        label="Logo URL"
        hint="Optional https image. Shown next to the business name. Leave blank for no logo."
        htmlFor="widget-logo"
      >
        <Input
          id="widget-logo"
          value={draft.logoUrl}
          onChange={(event) => onChange({ ...draft, logoUrl: event.target.value })}
          placeholder="https://example.com/logo.png"
        />
      </Field>
      <Field
        label="Welcome message"
        hint="First message visitors see before they type. Default copy identifies this as an AI assistant."
        htmlFor="widget-welcome"
      >
        <Textarea
          id="widget-welcome"
          value={draft.welcomeMessage}
          onChange={(event) => onChange({ ...draft, welcomeMessage: event.target.value })}
          rows={4}
        />
      </Field>
      <Field
        label="Suggested questions"
        hint={`One question per line, up to ${MAX_SUGGESTED_QUESTIONS}. Visitors can tap a question to send it.`}
        htmlFor="widget-questions"
      >
        <Textarea
          id="widget-questions"
          value={suggestedQuestionsText(draft.suggestedQuestions)}
          onChange={(event) =>
            onChange({
              ...draft,
              suggestedQuestions: event.target.value.split("\n"),
            })
          }
          rows={4}
        />
      </Field>
      <Field
        label="Accent color"
        hint="Hex color for the launcher and header. Blank uses BizPilot indigo, not teal."
        htmlFor="widget-accent"
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            aria-label="Accent color picker"
            className="h-11 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
            value={/^#([0-9a-fA-F]{6})$/.test(accentPreview) ? accentPreview : DEFAULT_WIDGET_ACCENT}
            onChange={(event) => onChange({ ...draft, accentColor: event.target.value })}
          />
          <Input
            id="widget-accent"
            value={draft.accentColor}
            onChange={(event) => onChange({ ...draft, accentColor: event.target.value })}
            placeholder={DEFAULT_WIDGET_ACCENT}
            className="max-w-40"
          />
          <span
            className="inline-flex size-11 items-center justify-center rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: accentPreview }}
            aria-hidden="true"
          >
            AI
          </span>
        </div>
      </Field>
      <Field label="Launcher position" hint="Where the chat button sits on your public website.">
        <Select
          value={draft.position}
          onValueChange={(value) => onChange({ ...draft, position: value as WidgetPosition })}
        >
          <SelectTrigger className="h-11 min-h-11 w-full min-w-0 sm:max-w-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WIDGET_POSITIONS.map((position) => (
              <SelectItem key={position} value={position}>
                {positionLabel(position)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Message placeholder"
        hint="Hint text inside the visitor’s message box."
        htmlFor="widget-placeholder"
      >
        <Input
          id="widget-placeholder"
          value={draft.placeholderPrompt}
          onChange={(event) => onChange({ ...draft, placeholderPrompt: event.target.value })}
          placeholder="Ask a question"
        />
      </Field>
      <div className="grid gap-3 rounded-xl border px-3 py-3">
        <label className={`${LABEL_CLASS} flex items-start justify-between gap-3`}>
          <span>
            Identify as an AI assistant
            <span className={`mt-1 block font-normal ${HELPER_TEXT_CLASS}`}>
              On by default. When off, the widget still does not claim to be a human.
            </span>
          </span>
          <Switch
            checked={draft.identifyAsAi}
            onCheckedChange={(checked) => onChange({ ...draft, identifyAsAi: checked })}
            aria-label="Identify as an AI assistant"
          />
        </label>
        <label className={`${LABEL_CLASS} flex items-start justify-between gap-3`}>
          <span>
            Ask for name and email
            <span className={`mt-1 block font-normal ${HELPER_TEXT_CLASS}`}>
              Optional for visitors. Saves on the conversation so you can follow up from Inbox.
              Does not create a Lead row.
            </span>
          </span>
          <Switch
            checked={draft.leadCaptureEnabled}
            onCheckedChange={(checked) =>
              onChange({
                ...draft,
                leadCaptureEnabled: checked,
                collectPhone: checked ? draft.collectPhone : false,
              })
            }
            aria-label="Ask for name and email"
          />
        </label>
        <label className={`${LABEL_CLASS} flex items-start justify-between gap-3`}>
          <span>
            Also ask for a phone number
            <span className={`mt-1 block font-normal ${HELPER_TEXT_CLASS}`}>
              Only shown when name and email collection is on.
            </span>
          </span>
          <Switch
            checked={draft.collectPhone}
            disabled={!draft.leadCaptureEnabled}
            onCheckedChange={(checked) => onChange({ ...draft, collectPhone: checked })}
            aria-label="Also ask for a phone number"
          />
        </label>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" disabled={disabled} aria-busy={saving} className="w-full sm:w-fit">
          {saveLabel}
        </Button>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
