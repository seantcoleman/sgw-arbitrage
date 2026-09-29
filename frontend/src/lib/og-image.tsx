import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export function renderOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#09090b",
          color: "#fafafa",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#16a34a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            B
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#d4d4d8" }}>BuzzerBidder</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>
            ShopGoodwill sniper.
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.05, color: "#4ade80" }}>
            Bid in the last seconds.
          </div>
        </div>
        <div style={{ fontSize: 28, color: "#a1a1aa" }}>
          eBay comps · Pay 2% only when you win · or Pro at $15/mo
        </div>
      </div>
    ),
    { ...ogSize }
  );
}
