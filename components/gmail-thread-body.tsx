"use client";

import { Button } from "@/components/ui/button";
import {
  GMAIL_BODY_CLASS,
  GMAIL_CONTENT_BOX_CLASS,
  GMAIL_QUOTED_BODY_CLASS,
  GMAIL_QUOTED_PANEL_CLASS,
  GMAIL_QUOTED_TOGGLE_CLASS,
  HIDE_PREVIOUS_MESSAGES_LABEL,
  SHOW_PREVIOUS_MESSAGES_LABEL,
} from "@/lib/gmail/email-layout";
import { splitGmailThread } from "@/lib/gmail/thread";
import { useState } from "react";

export function GmailThreadBody({ body, messageId }: { body: string; messageId: string }) {
  const { latest, quoted } = splitGmailThread(body);
  const [open, setOpen] = useState(false);

  return (
    <div className={GMAIL_CONTENT_BOX_CLASS}>
      <p className={GMAIL_BODY_CLASS}>{latest || body}</p>
      {quoted ? (
        <div className={`${GMAIL_CONTENT_BOX_CLASS} mt-1`}>
          <Button
            type="button"
            variant="outline"
            className={GMAIL_QUOTED_TOGGLE_CLASS}
            aria-expanded={open}
            aria-controls={`gmail-quoted-${messageId}`}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? HIDE_PREVIOUS_MESSAGES_LABEL : SHOW_PREVIOUS_MESSAGES_LABEL}
          </Button>
          {open ? (
            <div id={`gmail-quoted-${messageId}`} className={GMAIL_QUOTED_PANEL_CLASS}>
              <p className={GMAIL_QUOTED_BODY_CLASS}>{quoted}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
