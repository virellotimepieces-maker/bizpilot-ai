/** Layout tokens for `/app/social` and `/demo/social`. Desktop (`sm`/`lg`) stays a wrapping row. */

export const SOCIAL_CONTENT_BOX_CLASS =
  "box-border w-full max-w-full min-w-0";

export const SOCIAL_WRAP_TEXT_CLASS =
  "w-full max-w-full min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]";

export const SOCIAL_WRAP_INLINE_CLASS =
  "max-w-full min-w-0 [overflow-wrap:anywhere] [word-break:break-word]";

export const SOCIAL_CARD_CLASS =
  `${SOCIAL_CONTENT_BOX_CLASS} overflow-x-hidden rounded-2xl border bg-card p-3 shadow-sm sm:p-4`;

export const SOCIAL_PANE_GRID_CLASS =
  `${SOCIAL_CONTENT_BOX_CLASS} grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]`;

export const SOCIAL_PAGE_TITLE_CLASS =
  "font-heading mt-2 max-w-full min-w-0 text-xl leading-tight tracking-tight sm:text-2xl md:text-[2.25rem]";

export const SOCIAL_FIELD_CONTROL_CLASS =
  `${SOCIAL_CONTENT_BOX_CLASS} [overflow-wrap:anywhere] [word-break:break-word]`;

export const SOCIAL_TOOLBAR_CLASS =
  `${SOCIAL_CONTENT_BOX_CLASS} grid grid-cols-1 gap-2 sm:grid-cols-2`;

export const SOCIAL_ACTION_ROW_CLASS =
  `mt-4 ${SOCIAL_CONTENT_BOX_CLASS} grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap`;

export const SOCIAL_ACTION_BUTTON_CLASS =
  "h-11 min-h-11 w-full min-w-0 max-w-full justify-center text-sm sm:text-base lg:w-auto lg:text-lg";

export const SOCIAL_MODE_LABELS = ["Reply to message", "Create post"] as const;

export const SOCIAL_ACTION_LABELS = [
  "Generate reply",
  "Generate post",
  "Copy draft",
  "Regenerate",
] as const;

const PAGE_GUTTER_PX = 24;
const CARD_PADDING_PX = 24;

export function socialUsableContentWidth(viewportPx: number) {
  return Math.max(0, viewportPx - PAGE_GUTTER_PX - CARD_PADDING_PX);
}

export function socialActionsStackAt(viewportPx: number) {
  return viewportPx < 640;
}

export function socialWouldOverflowHorizontally(viewportPx: number) {
  if (viewportPx < 360) return true;
  if (!socialActionsStackAt(viewportPx)) return false;
  const content = socialUsableContentWidth(viewportPx);
  return SOCIAL_ACTION_LABELS.some((label) => label.length * 8 > content);
}
