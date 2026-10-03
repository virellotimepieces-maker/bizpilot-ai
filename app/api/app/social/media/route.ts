import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { BillingError } from "@/lib/billing/types";
import { jsonError } from "@/lib/http";
import { requireSocialWorkspace } from "@/lib/social/context";
import { SOCIAL_MEDIA_MAX_BYTES, validateSocialImage } from "@/lib/social/media";
import { isSocialOAuthPlatform, SOCIAL_PLATFORM_SPECS } from "@/lib/social/platforms";

export async function POST(request: NextRequest) {
  try {
    const { store, workspace } = await requireSocialWorkspace();
    const body = (await request.json()) as { platform?: string; mimeType?: string; dataBase64?: string };
    if (!body.platform || !isSocialOAuthPlatform(body.platform)) {
      throw new BillingError("Choose a supported social platform.", "invalid");
    }
    const media = SOCIAL_PLATFORM_SPECS[body.platform].media;
    if (media === "unsupported") {
      throw new BillingError(
        `${SOCIAL_PLATFORM_SPECS[body.platform].label} image posts are not available yet.`,
        "invalid",
      );
    }
    const encoded = body.dataBase64?.trim() || "";
    if (!encoded || encoded.length > Math.ceil(SOCIAL_MEDIA_MAX_BYTES * 4 / 3) + 16) {
      throw new BillingError("Use a JPEG, PNG, or WebP image up to 8 MB.", "invalid");
    }
    const bytes = Buffer.from(encoded, "base64");
    const image = validateSocialImage(bytes, body.mimeType || "");
    const asset = await store.createSocialMediaAsset({
      workspaceId: workspace.id,
      token: randomBytes(32).toString("base64url"),
      mimeType: image.mimeType,
      bytes,
    });
    return NextResponse.json({
      asset: { id: asset.id, mimeType: asset.mimeType, byteSize: asset.byteSize },
    });
  } catch (error) {
    return jsonError(error, "Could not attach the image.");
  }
}
