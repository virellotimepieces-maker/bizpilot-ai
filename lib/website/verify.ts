export function homepageHasWidgetSnippet(html: string, widgetKey: string) {
  const escaped = widgetKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`/w/${escaped}(?:\\.js)?`, "i").test(html);
}

export function wellKnownTokenMatches(body: string, token: string) {
  return body.trim() === token.trim();
}

export function verificationInstructions(domain: string, widgetKey: string, token: string) {
  return `Install the BizPilot snippet on ${domain} (it includes /w/${widgetKey}.js), or publish ${token} at https://${domain}/.well-known/bizpilot-verify.txt, then click Verify domain.`;
}
