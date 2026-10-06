import { ImageResponse } from "next/og";
import { formatPlanPriceUsd, HOME_METADATA, PUBLIC_PRODUCT_NAME } from "@/lib/marketing/copy";

export const alt = HOME_METADATA.title;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const priceLine = `${PUBLIC_PRODUCT_NAME} · ${formatPlanPriceUsd()}/month`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#eef1f8",
          color: "#1b2744",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 10,
              background: "#3d4eb8",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            BL
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>Bizlyro AI</div>
            <div style={{ display: "flex", fontSize: 18, color: "#5b6784" }}>{priceLine}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 700, lineHeight: 1.15 }}>
            {HOME_METADATA.title}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#4a5670", lineHeight: 1.4 }}>
            {HOME_METADATA.description}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
