import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { HoursEditor } from "../components/knowledge-editor";
import { emptyKnowledge } from "./empty-knowledge";
import { formatClockTime } from "./hours-display";

describe("hours editor markup", () => {
  it("shows Opens and Closes labels and complete selected times", () => {
    const kb = emptyKnowledge("service");
    kb.hours.days[0]!.closed = false;
    kb.hours.days[0]!.open = "09:00";
    kb.hours.days[0]!.close = "17:00";
    const html = renderToStaticMarkup(
      createElement(HoursEditor, { kb, patch: () => undefined }),
    );
    assert.match(html, /Opens/);
    assert.match(html, /Closes/);
    assert.match(html, /Timezone/);
    assert.match(html, new RegExp(formatClockTime("09:00")));
    assert.match(html, new RegExp(formatClockTime("17:00")));
    assert.match(html, /aria-label="Opens"/);
    assert.match(html, /aria-label="Closes"/);
    assert.match(html, /type="time"/);
    assert.match(html, /flex-col/);
  });
});
