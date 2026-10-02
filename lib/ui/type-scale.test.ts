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
import { DESK_MOBILE_PRIMARY, DESK_NAV, isDeskNavActive } from "./desk-nav";

describe("dashboard type scale", () => {
  it("keeps page titles at 20–24px instead of display sizes", () => {
    assert.match(PAGE_TITLE_CLASS, /text-xl/);
    assert.match(PAGE_TITLE_CLASS, /md:text-2xl/);
    assert.doesNotMatch(PAGE_TITLE_CLASS, /text-4xl|text-5xl|text-6xl|text-\[1\.875rem\]|text-\[2\.25rem\]/);
  });

  it("keeps section headings at 18–20px and labels at 14px", () => {
    assert.match(SECTION_HEADING_CLASS, /text-lg/);
    assert.match(SECTION_HEADING_CLASS, /md:text-xl/);
    assert.match(LABEL_CLASS, /text-sm/);
  });

  it("uses 16px control text, 14px buttons, and 14px helper copy", () => {
    assert.match(CONTROL_TEXT_CLASS, /text-base/);
    assert.match(BUTTON_TEXT_CLASS, /text-sm/);
    assert.match(HELPER_TEXT_CLASS, /text-sm/);
  });

  it("keeps 44px touch targets and prevents horizontal overflow on 320–430px widths", () => {
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

describe("V2 desk navigation", () => {
  it("lists the approved dashboard destinations", () => {
    assert.deepEqual(
      DESK_NAV.map((item) => item.label),
      [
        "Overview",
        "Inbox",
        "Leads",
        "Knowledge",
        "Analytics",
        "Integrations",
        "Widget",
        "Settings",
        "Billing",
      ],
    );
    assert.equal(DESK_MOBILE_PRIMARY.length, 4);
  });

  it("does not treat nested routes as Overview", () => {
    assert.equal(isDeskNavActive("/app", DESK_NAV[0]!), true);
    assert.equal(isDeskNavActive("/app/inbox", DESK_NAV[0]!), false);
    assert.equal(isDeskNavActive("/app/email", DESK_NAV.find((item) => item.id === "integrations")!), true);
    assert.equal(isDeskNavActive("/billing", DESK_NAV.find((item) => item.id === "billing")!), true);
  });
});
