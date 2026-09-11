import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUTTON_TEXT_CLASS,
  CONTROL_TEXT_CLASS,
  HELPER_TEXT_CLASS,
  LABEL_CLASS,
  PAGE_SHELL_CLASS,
  PAGE_TITLE_CLASS,
  SECTION_HEADING_CLASS,
  TAB_ITEM_CLASS,
  TAB_ROW_CLASS,
  TOUCH_TARGET_CLASS,
} from "./type-scale";

describe("dashboard type scale", () => {
  it("caps page titles at 30px on mobile and 36px from the 768px breakpoint", () => {
    assert.match(PAGE_TITLE_CLASS, /text-\[1\.875rem\]/);
    assert.match(PAGE_TITLE_CLASS, /md:text-\[2\.25rem\]/);
    assert.doesNotMatch(PAGE_TITLE_CLASS, /text-4xl|text-5xl|text-6xl/);
  });

  it("keeps section headings at 24–28px and labels at 16–18px", () => {
    assert.match(SECTION_HEADING_CLASS, /text-2xl/);
    assert.match(SECTION_HEADING_CLASS, /md:text-\[1\.75rem\]/);
    assert.match(LABEL_CLASS, /text-base/);
    assert.match(LABEL_CLASS, /md:text-lg/);
  });

  it("uses 16px control text, 16–18px buttons, and 14–16px helper copy", () => {
    assert.match(CONTROL_TEXT_CLASS, /text-base/);
    assert.match(BUTTON_TEXT_CLASS, /text-base/);
    assert.match(BUTTON_TEXT_CLASS, /md:text-lg/);
    assert.match(HELPER_TEXT_CLASS, /text-sm/);
    assert.match(HELPER_TEXT_CLASS, /md:text-base/);
  });

  it("keeps 44px touch targets and prevents horizontal overflow on 360–430px widths", () => {
    assert.match(TOUCH_TARGET_CLASS, /min-h-11/);
    assert.match(PAGE_SHELL_CLASS, /overflow-x-hidden/);
    assert.match(PAGE_SHELL_CLASS, /min-w-0/);
    assert.match(PAGE_SHELL_CLASS, /gap-4/);
    assert.match(TAB_ROW_CLASS, /overflow-x-auto/);
    assert.match(TAB_ITEM_CLASS, /whitespace-nowrap/);
    assert.match(TAB_ITEM_CLASS, /min-h-11/);
    assert.match(TAB_ITEM_CLASS, /shrink-0/);
  });
});
