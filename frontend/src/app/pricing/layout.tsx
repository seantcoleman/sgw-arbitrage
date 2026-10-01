import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Pay Only When You Win",
  description:
    "BuzzerBidder Standard is a 2% ShopGoodwill success fee with no monthly charge. Pro is $10/month with 0% commission. No fee if you do not win.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "BuzzerBidder pricing — pay only when you win",
    description:
      "2% on confirmed ShopGoodwill wins, or $10/month Pro with 0% commission.",
    url: "https://buzzerbidder.com/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
