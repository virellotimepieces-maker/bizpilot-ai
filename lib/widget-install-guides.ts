export const WIDGET_PLATFORMS = [
  { id: "shopify", label: "Shopify" },
  { id: "wordpress", label: "WordPress" },
  { id: "wix", label: "Wix" },
  { id: "squarespace", label: "Squarespace" },
  { id: "custom", label: "Custom HTML website" },
] as const;

export type WidgetPlatformId = (typeof WIDGET_PLATFORMS)[number]["id"];

export type WidgetInstallGuide = {
  id: WidgetPlatformId;
  label: string;
  pasteWhere: string;
  publishHow: string;
  steps: string[];
};

export const WIDGET_SECRET_WARNING =
  "Never share API keys, database credentials, passwords, or Stripe secrets. Only the generated widget snippet on this page is safe to paste on your website.";

export const WIDGET_VERIFY_STEPS = [
  "Open your public website in a new browser tab — the live site visitors use, not this BizPilot page.",
  "Look in the bottom-right corner for the BizPilot chat launcher.",
  "Tap or click it and send a short test question. If the chat opens, the widget is installed.",
];

export const WIDGET_TROUBLESHOOTING = [
  {
    id: "missing",
    title: "Widget does not appear",
    body: "Confirm you saved and published the change, then hard-refresh the public page (Ctrl+Shift+R or Cmd+Shift+R). Check that you are on the live website, not a password-protected preview or a single blog post that never received the snippet.",
  },
  {
    id: "cache",
    title: "Cache or CDN delay",
    body: "Some hosts keep an old copy of the page for a few minutes. Wait 2–5 minutes, purge cache in Shopify, WordPress, Cloudflare, or your CDN, then try a private/incognito window.",
  },
  {
    id: "duplicate",
    title: "Snippet pasted more than once",
    body: "Search your theme or custom-code settings for “bizpilot” or “/w/”. Leave only one copy of the snippet. Extra copies can stack two chat windows or stop the launcher from loading.",
  },
  {
    id: "inactive",
    title: "Subscription inactive",
    body: "The widget only runs while BizPilot Pro is active. Open Billing in BizPilot, update payment if needed, then refresh the public website.",
  },
  {
    id: "csp",
    title: "Content Security Policy blocking the script",
    body: "If the chat never appears and the browser developer tools mention Content-Security-Policy, your host is blocking outside scripts. Ask whoever manages the site to allow this BizPilot script origin from the snippet. Until that rule is added, the widget cannot load.",
  },
] as const;

const GUIDES: Record<WidgetPlatformId, WidgetInstallGuide> = {
  shopify: {
    id: "shopify",
    label: "Shopify",
    pasteWhere:
      "Paste the snippet into a Custom Liquid / custom-code block in the theme footer, or on its own line just before </body> in layout/theme.liquid.",
    publishHow: "Click Save in the theme editor. If Shopify asks you to publish the theme, publish it so the live store updates.",
    steps: [
      "Copy your unique BizPilot snippet above.",
      "In Shopify, go to Online Store → Themes.",
      "Click Customize on the theme your customers see.",
      "Add a Custom Liquid or custom-code block in the footer and paste the snippet. If you do not see that option, open the three-dot menu next to Customize, choose Edit code, open layout/theme.liquid, and paste the snippet on a new line just before </body>.",
      "Click Save, then publish the theme if Shopify asks you to.",
    ],
  },
  wordpress: {
    id: "wordpress",
    label: "WordPress",
    pasteWhere:
      "Paste the snippet into a Footer / Header & Footer code box that loads on every page (for example WPCode), not into a single blog post.",
    publishHow: "Click Save in the plugin. If you use a cache plugin, purge the cache so the public site picks up the snippet.",
    steps: [
      "Copy your unique BizPilot snippet above.",
      "In WordPress, go to Plugins → Add New, search for WPCode, then install and activate it.",
      "Open Code Snippets → Header & Footer (or WPCode → Header & Footer).",
      "Paste the snippet into the Footer box so it loads at the bottom of every page.",
      "Click Save. Purge any cache plugin, then open the public website.",
    ],
  },
  wix: {
    id: "wix",
    label: "Wix",
    pasteWhere:
      "Paste the snippet in Settings → Custom Code, applied to All pages, placed in Body — end.",
    publishHow: "Click Apply on the custom code, then click Publish in the Wix editor so visitors see the live site.",
    steps: [
      "Copy your unique BizPilot snippet above.",
      "In Wix, go to Settings → Custom Code (under Advanced).",
      "Click + Add Custom Code and paste the snippet. Name it BizPilot.",
      "Choose All pages and set Place code in to Body — end.",
      "Click Apply, then Publish the site.",
    ],
  },
  squarespace: {
    id: "squarespace",
    label: "Squarespace",
    pasteWhere:
      "Paste the snippet into Code Injection → Footer so it loads on every page.",
    publishHow: "Click Save in Code Injection. If Squarespace shows unpublished changes, click Publish.",
    steps: [
      "Copy your unique BizPilot snippet above.",
      "Open Website → Pages → Website Tools → Code Injection. (On some plans this is Settings → Developer Tools → Code Injection.)",
      "Paste the snippet into the Footer box.",
      "Click Save.",
      "Publish the site if Squarespace shows unpublished changes.",
    ],
  },
  custom: {
    id: "custom",
    label: "Custom HTML website",
    pasteWhere:
      "Paste the snippet on its own line just before the closing </body> tag of the layout that wraps every public page.",
    publishHow: "Save the file, then upload or deploy it the same way you normally publish the website.",
    steps: [
      "Copy your unique BizPilot snippet above.",
      "Open the HTML or template file that wraps every public page (often index.html or a shared layout).",
      "Paste the snippet on a new line just before </body>.",
      "Save the file.",
      "Upload or deploy the site the same way you usually publish changes.",
    ],
  },
};

export function getWidgetInstallGuide(platform: WidgetPlatformId): WidgetInstallGuide {
  return GUIDES[platform];
}

export const WIDGET_INSTALL_GUIDE_LAYOUT_CLASS =
  "grid gap-4 text-sm leading-relaxed break-words";
