import type { Metadata } from "next";
import {
  PRO_MONTHLY_USD,
  PRO_SUCCESS_FEE_PCT,
  STANDARD_FEE_LABEL,
} from "@/lib/seo";

export const metadata: Metadata = {
  title: "Pricing — Pay Only When You Win",
  description: `BuzzerBidder Standard is a ${STANDARD_FEE_LABEL} ShopGoodwill success fee with no monthly charge. Pro is $${PRO_MONTHLY_USD}/month with ${PRO_SUCCESS_FEE_PCT}% commission. No fee if you do not win.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "BuzzerBidder pricing — pay only when you win",
    description: `${STANDARD_FEE_LABEL} on confirmed ShopGoodwill wins, or $${PRO_MONTHLY_USD}/month Pro with ${PRO_SUCCESS_FEE_PCT}% commission.`,
    url: "https://buzzerbidder.com/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
