import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { EMAIL_AI_HELPER_COPY } from "../ai/email-identity";
import {
  GMAIL_ACTION_BUTTON_CLASS,
  GMAIL_ACTION_LABELS,
  GMAIL_ACTION_ROW_CLASS,
  GMAIL_BODY_CLASS,
  GMAIL_CARD_CLASS,
  GMAIL_CONTENT_BOX_CLASS,
  GMAIL_FIELD_CONTROL_CLASS,
  GMAIL_PANE_GRID_CLASS,
  GMAIL_PAGE_TITLE_CLASS,
  GMAIL_TOOLBAR_CLASS,
  GMAIL_QUOTED_PANEL_CLASS,
  GMAIL_QUOTED_TOGGLE_CLASS,
  GMAIL_WRAP_TEXT_CLASS,
  SHOW_PREVIOUS_MESSAGES_LABEL,
  gmailActionsStackAt,
  gmailUsableContentWidth,
  gmailWouldOverflowHorizontally,
} from "./email-layout";

describe("paid Gmail email mobile layout", () => {
  it("keeps all Gmail actions visible in a 360px Android viewport without horizontal overflow", () => {
    const viewport = 360;
    assert.equal(gmailActionsStackAt(viewport), true);
    assert.equal(gmailActionsStackAt(639), true);
    assert.equal(gmailActionsStackAt(640), false);
    assert.equal(gmailWouldOverflowHorizontally(viewport), false);
    assert.equal(gmailWouldOverflowHorizontally(412), false);
    const content = gmailUsableContentWidth(viewport);
    assert.ok(content >= 280);
    assert.deepEqual([...GMAIL_ACTION_LABELS], [
      "Regenerate reply",
      "Edit reply",
      "Copy reply",
      "Send reply",
    ]);
    for (const label of GMAIL_ACTION_LABELS) {
      assert.ok(
        label.length * 8 <= content,
        `${label} must fit the ${content}px stacked action column at ${viewport}px`,
      );
    }
    assert.match(GMAIL_ACTION_ROW_CLASS, /grid-cols-1/);
    assert.match(GMAIL_ACTION_ROW_CLASS, /sm:grid-cols-2/);
    assert.match(GMAIL_ACTION_BUTTON_CLASS, /w-full/);
    assert.match(GMAIL_ACTION_BUTTON_CLASS, /lg:w-auto/);
  });

  it("forces cards, bodies, and fields to wrap inside the viewport", () => {
    for (const value of [
      GMAIL_CONTENT_BOX_CLASS,
      GMAIL_CARD_CLASS,
      GMAIL_BODY_CLASS,
      GMAIL_FIELD_CONTROL_CLASS,
      GMAIL_WRAP_TEXT_CLASS,
    ]) {
      assert.match(value, /w-full/);
      assert.match(value, /max-w-full/);
      assert.match(value, /min-w-0/);
    }
    assert.match(GMAIL_WRAP_TEXT_CLASS, /overflow-wrap:anywhere/);
    assert.match(GMAIL_WRAP_TEXT_CLASS, /word-break:break-word/);
    assert.match(GMAIL_WRAP_TEXT_CLASS, /whitespace-pre-wrap/);
    assert.match(GMAIL_PANE_GRID_CLASS, /minmax\(0,/);
    assert.doesNotMatch(GMAIL_PANE_GRID_CLASS, /16rem/);
    assert.match(GMAIL_PAGE_TITLE_CLASS, /text-xl/);
    assert.match(GMAIL_PAGE_TITLE_CLASS, /md:text-\[2\.25rem\]/);
    assert.match(GMAIL_TOOLBAR_CLASS, /grid-cols-1/);
  });

  it("applies the 360px layout on the paid /app/email Gmail component", () => {
    const source = readFileSync("components/paid-email-inbox.tsx", "utf8");
    assert.match(source, /PaidEmailInbox/);
    assert.match(source, /GMAIL_ACTION_ROW_CLASS/);
    assert.match(source, /GMAIL_ACTION_BUTTON_CLASS/);
    assert.match(source, /GMAIL_WRAP_TEXT_CLASS|GMAIL_BODY_CLASS/);
    assert.match(source, /confirmSend/);
    assert.match(source, /confirm: true/);
    assert.match(source, /Send reply/);
    assert.doesNotMatch(source, /minmax\(16rem/);
    for (const label of GMAIL_ACTION_LABELS) {
      assert.ok(source.includes(label), `missing ${label}`);
    }
    assert.match(source, /aria-label="Regenerate suggested reply"/);
    assert.match(source, /aria-label="Edit suggested reply"/);
    assert.match(source, /aria-label="Send suggested reply"/);
    assert.match(source, /htmlFor="gmail-draft-subject"/);
    assert.match(source, /htmlFor="gmail-draft-body"/);
    assert.match(source, /Replace your edited draft/);
    assert.match(source, /hideEmpty/);
    assert.match(source, /GmailThreadBody/);
    assert.equal(
      EMAIL_AI_HELPER_COPY,
      "AI drafts a relevant reply from the incoming email, using your Knowledge as optional business or personal context. Review before sending. Email never auto-sends.",
    );
  });

  it("collapses quoted Gmail history under Show previous messages and caps height on mobile", () => {
    const inbox = readFileSync("components/paid-email-inbox.tsx", "utf8");
    const threadBody = readFileSync("components/gmail-thread-body.tsx", "utf8");
    assert.match(inbox, /GmailThreadBody/);
    assert.match(inbox, /body=\{detail\.body\}/);
    assert.doesNotMatch(inbox, /<p className=\{GMAIL_BODY_CLASS\}>\{detail\.body\}<\/p>/);
    assert.equal(SHOW_PREVIOUS_MESSAGES_LABEL, "Show previous messages.");
    assert.match(threadBody, /SHOW_PREVIOUS_MESSAGES_LABEL/);
    assert.match(threadBody, /splitGmailThread/);
    assert.match(GMAIL_QUOTED_TOGGLE_CLASS, /h-11/);
    assert.match(GMAIL_QUOTED_TOGGLE_CLASS, /w-full/);
    assert.match(GMAIL_QUOTED_PANEL_CLASS, /max-h-\[40vh\]/);
    assert.match(GMAIL_QUOTED_PANEL_CLASS, /overflow-y-auto/);
    assert.match(GMAIL_QUOTED_PANEL_CLASS, /overflow-x-hidden/);
  });
});
