import { ogContentType, ogSize, renderOgImage } from "@/lib/og-image";

export const runtime = "edge";
export const alt = "BuzzerBidder — ShopGoodwill sniper with last-second bids";
export const size = ogSize;
export const contentType = ogContentType;

export default function TwitterImage() {
  return renderOgImage();
}
