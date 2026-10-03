import { PRODUCTION_PUBLIC_ORIGIN } from "@/lib/public-origin";

export const SOCIAL_OAUTH_PLATFORMS = [
  "facebook",
  "instagram",
  "linkedin",
  "threads",
  "x",
  "pinterest",
] as const;

export type SocialOAuthPlatform = (typeof SOCIAL_OAUTH_PLATFORMS)[number];

export type SocialMediaMode = "required" | "optional" | "unsupported";

type SocialPlatformSpec = {
  label: string;
  idEnv: string;
  secretEnv: string;
  enableEnv: string;
  scopes: string[];
  requiredPermission: string;
  media: SocialMediaMode;
  setupNotes: string[];
};

export const SOCIAL_PLATFORM_SPECS: Record<SocialOAuthPlatform, SocialPlatformSpec> = {
  facebook: {
    label: "Facebook Pages",
    idEnv: "META_APP_ID",
    secretEnv: "META_APP_SECRET",
    enableEnv: "META_PUBLISH_ENABLED",
    scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "business_management"],
    requiredPermission: "pages_manage_posts",
    media: "optional",
    setupNotes: [
      "Create a Meta app and add Facebook Login.",
      "Request pages_show_list, pages_manage_posts, pages_read_engagement, and business_management.",
      "Complete Meta App Review for those permissions before subscribers other than app roles can connect.",
      "Register the Facebook callback URL on the Meta app.",
      "Set META_APP_ID, META_APP_SECRET, and META_PUBLISH_ENABLED=true only after that review is approved.",
    ],
  },
  instagram: {
    label: "Instagram professional",
    idEnv: "META_APP_ID",
    secretEnv: "META_APP_SECRET",
    enableEnv: "META_INSTAGRAM_PUBLISH_ENABLED",
    scopes: [
      "pages_show_list",
      "pages_read_engagement",
      "instagram_basic",
      "instagram_content_publish",
      "business_management",
    ],
    requiredPermission: "instagram_content_publish",
    media: "required",
    setupNotes: [
      "Use the same Meta app as Facebook and add the Instagram product.",
      "The Instagram account must be a professional account linked to a Facebook Page.",
      "Request instagram_basic and instagram_content_publish, then complete Meta App Review.",
      "Instagram feed publishing requires an image. Text-only posts stay disabled.",
      "Set META_APP_ID, META_APP_SECRET, and META_INSTAGRAM_PUBLISH_ENABLED=true only after review is approved.",
    ],
  },
  linkedin: {
    label: "LinkedIn",
    idEnv: "LINKEDIN_CLIENT_ID",
    secretEnv: "LINKEDIN_CLIENT_SECRET",
    enableEnv: "LINKEDIN_PUBLISH_ENABLED",
    scopes: ["openid", "profile", "w_member_social"],
    requiredPermission: "w_member_social",
    media: "unsupported",
    setupNotes: [
      "Create a LinkedIn app and add the Share on LinkedIn product, or Community Management if you are posting as a member.",
      "Request openid, profile, and w_member_social. w_member_social requires LinkedIn product approval.",
      "Company Page posting is not enabled. This connection publishes to the authorized member profile.",
      "Image posts are not available for LinkedIn yet.",
      "Register the LinkedIn callback URL.",
      "Set LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, and LINKEDIN_PUBLISH_ENABLED=true only after approval.",
    ],
  },
  threads: {
    label: "Threads",
    idEnv: "META_APP_ID",
    secretEnv: "META_APP_SECRET",
    enableEnv: "THREADS_PUBLISH_ENABLED",
    scopes: ["threads_basic", "threads_content_publish"],
    requiredPermission: "threads_content_publish",
    media: "optional",
    setupNotes: [
      "Add the Threads API product to the Meta app.",
      "Request threads_basic and threads_content_publish and complete Threads access review.",
      "Register the Threads callback URL.",
      "Set META_APP_ID, META_APP_SECRET, and THREADS_PUBLISH_ENABLED=true only after review is approved.",
    ],
  },
  x: {
    label: "X",
    idEnv: "X_CLIENT_ID",
    secretEnv: "X_CLIENT_SECRET",
    enableEnv: "X_POSTING_ENABLED",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    requiredPermission: "tweet.write",
    media: "unsupported",
    setupNotes: [
      "Create an X app with OAuth 2.0 and PKCE.",
      "Enable tweet.read, tweet.write, users.read, and offline.access.",
      "Posting requires a paid X API tier that allows POST /2/tweets. A free app is not enough.",
      "Image posts are not available for X yet.",
      "Register the X callback URL.",
      "Set X_CLIENT_ID, X_CLIENT_SECRET, and X_POSTING_ENABLED=true only after paid posting access is active.",
    ],
  },
  pinterest: {
    label: "Pinterest",
    idEnv: "PINTEREST_APP_ID",
    secretEnv: "PINTEREST_APP_SECRET",
    enableEnv: "PINTEREST_PUBLISH_ENABLED",
    scopes: ["boards:read", "pins:write", "user_accounts:read"],
    requiredPermission: "pins:write",
    media: "required",
    setupNotes: [
      "Create a Pinterest app and request boards:read, pins:write, and user_accounts:read.",
      "Standard access approval is required before subscribers can create pins.",
      "A pin requires an image and a board. Text-only pins stay disabled.",
      "Register the Pinterest callback URL.",
      "Set PINTEREST_APP_ID, PINTEREST_APP_SECRET, and PINTEREST_PUBLISH_ENABLED=true only after approval.",
    ],
  },
};

export function isSocialOAuthPlatform(value: string): value is SocialOAuthPlatform {
  return (SOCIAL_OAUTH_PLATFORMS as readonly string[]).includes(value);
}

export function socialCallbackPath(platform: SocialOAuthPlatform) {
  return `/api/app/social/callback/${platform}`;
}

export function socialCallbackUrl(appUrl: string, platform: SocialOAuthPlatform) {
  return `${appUrl.replace(/\/$/, "")}${socialCallbackPath(platform)}`;
}

export function productionSocialCallbackUrls() {
  return SOCIAL_OAUTH_PLATFORMS.map((platform) => socialCallbackUrl(PRODUCTION_PUBLIC_ORIGIN, platform));
}

function envValue(name: string) {
  return process.env[name]?.trim() || "";
}

export type SocialPlatformConfig = SocialPlatformSpec & {
  platform: SocialOAuthPlatform;
  clientId: string;
  clientSecret: string;
  configured: boolean;
  missing: string[];
  redirectUri: string;
};

export function socialPlatformConfig(platform: SocialOAuthPlatform): SocialPlatformConfig {
  const spec = SOCIAL_PLATFORM_SPECS[platform];
  const missing: string[] = [];
  const clientId = envValue(spec.idEnv);
  const clientSecret = envValue(spec.secretEnv);
  if (!clientId) missing.push(spec.idEnv);
  if (!clientSecret) missing.push(spec.secretEnv);
  if (envValue(spec.enableEnv) !== "true") missing.push(spec.enableEnv);
  const appUrl = envValue("APP_URL");
  if (!appUrl) missing.push("APP_URL");
  if (!envValue("AUTH_SECRET")) missing.push("AUTH_SECRET");
  return {
    ...spec,
    platform,
    clientId,
    clientSecret,
    configured: missing.length === 0,
    missing,
    redirectUri: appUrl ? socialCallbackUrl(appUrl, platform) : "",
  };
}
