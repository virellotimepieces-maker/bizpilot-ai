/** Layout tokens for the paid `/app/email` Gmail inbox. Desktop (`sm`/`lg`) stays a wrapping row. */

export const GMAIL_CONTENT_BOX_CLASS =
  "box-border w-full max-w-full min-w-0";

export const GMAIL_WRAP_TEXT_CLASS =
  "w-full max-w-full min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] [word-break:break-word]";

export const GMAIL_WRAP_INLINE_CLASS =
  "max-w-full min-w-0 [overflow-wrap:anywhere] [word-break:break-word]";

export const GMAIL_CARD_CLASS =
  `${GMAIL_CONTENT_BOX_CLASS} overflow-x-hidden rounded-2xl border bg-card p-3 shadow-sm sm:p-4`;

export const GMAIL_PANE_GRID_CLASS =
  `${GMAIL_CONTENT_BOX_CLASS} grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]`;

export const GMAIL_PAGE_TITLE_CLASS =
  "font-heading mt-2 max-w-full min-w-0 text-xl leading-tight tracking-tight sm:text-2xl md:text-[2.25rem]";

export const GMAIL_SUBJECT_CLASS =
  `mt-3 font-heading text-base leading-snug sm:text-xl ${GMAIL_WRAP_INLINE_CLASS}`;

export const GMAIL_BODY_CLASS =
  `mt-4 text-sm leading-relaxed sm:text-sm ${GMAIL_WRAP_TEXT_CLASS}`;

export const GMAIL_FIELD_CONTROL_CLASS =
  `${GMAIL_CONTENT_BOX_CLASS} [overflow-wrap:anywhere] [word-break:break-word]`;

export const GMAIL_TOOLBAR_CLASS =
  `${GMAIL_CONTENT_BOX_CLASS} grid grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap`;

export const GMAIL_ACTION_ROW_CLASS =
  `mt-4 ${GMAIL_CONTENT_BOX_CLASS} grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap`;

export const GMAIL_ACTION_BUTTON_CLASS =
  "h-11 min-h-11 w-full min-w-0 max-w-full justify-center text-sm sm:text-base lg:w-auto lg:text-lg";

export const GMAIL_ACTION_LABELS = [
  "Regenerate reply",
  "Edit reply",
  "Copy reply",
  "Send reply",
] as const;

const PAGE_GUTTER_PX = 24;
const CARD_PADDING_PX = 24;

export function gmailUsableContentWidth(viewportPx: number) {
  return Math.max(0, viewportPx - PAGE_GUTTER_PX - CARD_PADDING_PX);
}

export function gmailActionsStackAt(viewportPx: number) {
  return viewportPx < 640;
}

export function gmailWouldOverflowHorizontally(viewportPx: number) {
  if (viewportPx < 360) return true;
  if (!gmailActionsStackAt(viewportPx)) return false;
  const content = gmailUsableContentWidth(viewportPx);
  return GMAIL_ACTION_LABELS.some((label) => label.length * 8 > content);
}
