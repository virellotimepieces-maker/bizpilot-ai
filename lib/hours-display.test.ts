import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatClockTime,
  HOURS_DAY_ROW_CLASS,
  HOURS_TIME_FIELDS_CLASS,
  HOURS_TIME_INPUT_CLASS,
} from "./hours-display";

describe("hours display", () => {
  it("formats stored 24-hour values as complete 12-hour times", () => {
    assert.equal(formatClockTime("09:00"), "9:00 AM");
    assert.equal(formatClockTime("17:00"), "5:00 PM");
    assert.equal(formatClockTime("00:00"), "12:00 AM");
    assert.equal(formatClockTime("12:30"), "12:30 PM");
  });

  it("keeps invalid stored values unchanged", () => {
    assert.equal(formatClockTime("closed"), "closed");
    assert.equal(formatClockTime(""), "");
  });

  it("stacks weekday rows on 320–430px and expands on desktop", () => {
    assert.match(HOURS_DAY_ROW_CLASS, /flex-col/);
    assert.match(HOURS_DAY_ROW_CLASS, /sm:grid/);
    assert.match(HOURS_TIME_FIELDS_CLASS, /grid-cols-1/);
    assert.match(HOURS_TIME_FIELDS_CLASS, /min-\[400px\]:grid-cols-2/);
    assert.match(HOURS_TIME_FIELDS_CLASS, /sm:contents/);
    assert.match(HOURS_TIME_INPUT_CLASS, /min-h-11/);
    assert.match(HOURS_TIME_INPUT_CLASS, /w-full/);
    assert.match(HOURS_TIME_INPUT_CLASS, /text-base/);
    assert.match(HOURS_TIME_INPUT_CLASS, /min-w-0/);
  });
});
