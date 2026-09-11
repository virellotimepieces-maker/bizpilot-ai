export const WIDGET_NEAR_BOTTOM_PX = 80;

export const WIDGET_SCROLL_INTO_VIEW_OPTIONS = {
  behavior: "smooth",
  block: "end",
} as const satisfies ScrollIntoViewOptions;

type ScrollBox = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

export function isNearBottom(container: ScrollBox, thresholdPx = WIDGET_NEAR_BOTTOM_PX) {
  const distance = container.scrollHeight - container.clientHeight - container.scrollTop;
  return distance <= thresholdPx;
}

export function shouldFollowNewMessages(pinnedToBottom: boolean) {
  return pinnedToBottom;
}

export function scrollMessagesToLatest(
  anchor: { scrollIntoView: (options?: ScrollIntoViewOptions) => void } | null | undefined,
) {
  if (!anchor) return;
  anchor.scrollIntoView(WIDGET_SCROLL_INTO_VIEW_OPTIONS);
}
