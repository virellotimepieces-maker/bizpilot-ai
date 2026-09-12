import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  isNearBottom,
  scrollMessagesToLatest,
  shouldFollowNewMessages,
  WIDGET_NEAR_BOTTOM_PX,
  WIDGET_SCROLL_INTO_VIEW_OPTIONS,
} from "./widget-chat-scroll";

describe("widget chat auto-scroll", () => {
  it("treats the user as pinned when they are at or near the bottom", () => {
    assert.equal(
      isNearBottom({ scrollTop: 400, scrollHeight: 500, clientHeight: 100 }),
      true,
    );
    assert.equal(
      isNearBottom({
        scrollTop: 500 - 100 - WIDGET_NEAR_BOTTOM_PX,
        scrollHeight: 500,
        clientHeight: 100,
      }),
      true,
    );
    assert.equal(
      isNearBottom({
        scrollTop: 500 - 100 - WIDGET_NEAR_BOTTOM_PX - 1,
        scrollHeight: 500,
        clientHeight: 100,
      }),
      false,
    );
    assert.equal(isNearBottom({ scrollTop: 0, scrollHeight: 100, clientHeight: 100 }), true);
  });

  it("does not follow new messages while the user is reading older ones", () => {
    assert.equal(shouldFollowNewMessages(true), true);
    assert.equal(shouldFollowNewMessages(false), false);
  });

  it("scrolls the bottom anchor with smooth end alignment", () => {
    assert.deepEqual(WIDGET_SCROLL_INTO_VIEW_OPTIONS, {
      behavior: "smooth",
      block: "end",
    });
    const calls: unknown[] = [];
    scrollMessagesToLatest({
      scrollIntoView(options) {
        calls.push(options);
      },
    });
    assert.deepEqual(calls, [WIDGET_SCROLL_INTO_VIEW_OPTIONS]);
    scrollMessagesToLatest(null);
    assert.equal(calls.length, 1);
  });

  it("wires the embed chat to scroll only the messages container", () => {
    const chat = readFileSync("components/widget-chat.tsx", "utf8");
    assert.match(chat, /scrollMessagesToLatest/);
    assert.match(chat, /isNearBottom/);
    assert.match(chat, /data-widget-scroll-anchor/);
    assert.match(chat, /overscroll-contain/);
    assert.match(chat, /pinToBottomRef\.current = true/);
    assert.match(chat, /ResizeObserver/);
    assert.match(chat, /Talk to a person/);
    assert.match(chat, /role === "human"/);
    assert.match(chat, /setInterval\(\(\) => \{\s*void syncThread\(\);/);
    assert.doesNotMatch(chat, /window\.scrollTo|document\.documentElement\.scroll/);
  });
});
