function encodeSubject(subject: string) {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

export function buildReplyRfc822(input: {
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
}) {
  const subject = input.subject.trim() || "Re:";
  const headers = [
    `From: ${input.fromEmail}`,
    `To: ${input.toEmail}`,
    `Subject: ${encodeSubject(subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
  ];
  if (input.inReplyTo) {
    headers.splice(3, 0, `In-Reply-To: ${input.inReplyTo}`, `References: ${input.inReplyTo}`);
  }
  const body = input.body.replace(/\r?\n/g, "\r\n");
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

export function toGmailRaw(rfc822: string) {
  return Buffer.from(rfc822, "utf8").toString("base64url");
}

export function gmailSendPayload(input: {
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  threadId: string;
  inReplyTo?: string | null;
}) {
  return {
    raw: toGmailRaw(
      buildReplyRfc822({
        fromEmail: input.fromEmail,
        toEmail: input.toEmail,
        subject: input.subject,
        body: input.body,
        inReplyTo: input.inReplyTo,
      }),
    ),
    threadId: input.threadId,
  };
}
