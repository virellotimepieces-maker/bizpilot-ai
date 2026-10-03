import { BillingError } from "@/lib/billing/types";

export const SOCIAL_MEDIA_MAX_BYTES = 8 * 1024 * 1024;

const ALLOWED = ["image/jpeg", "image/png", "image/webp"] as const;
export type SocialImageMime = (typeof ALLOWED)[number];

function detectedMime(bytes: Buffer): SocialImageMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function validateSocialImage(bytes: Buffer, declaredMime: string): { mimeType: SocialImageMime } {
  if (bytes.byteLength <= 0 || bytes.byteLength > SOCIAL_MEDIA_MAX_BYTES) {
    throw new BillingError("Use a JPEG, PNG, or WebP image up to 8 MB.", "invalid");
  }
  const mimeType = detectedMime(bytes);
  if (!mimeType || !(ALLOWED as readonly string[]).includes(declaredMime) || declaredMime !== mimeType) {
    throw new BillingError("Use a JPEG, PNG, or WebP image. Other file types are not sent.", "invalid");
  }
  return { mimeType };
}
