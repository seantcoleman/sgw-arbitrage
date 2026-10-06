export const SITE_URL = "https://buzzerbidder.com";

export const SITE_NAME = "BuzzerBidder";

/** Single source of truth for marketing + JSON-LD claim copy. Keep in sync with Stripe. */
export const STANDARD_SUCCESS_FEE_PCT = 2;
export const PRO_MONTHLY_USD = 10;
export const PRO_SUCCESS_FEE_PCT = 0;

export const STANDARD_FEE_LABEL = `${STANDARD_SUCCESS_FEE_PCT}%`;
export const PRO_PRICE_LABEL = `$${PRO_MONTHLY_USD}/month`;
export const PRO_PRICE_SHORT = `$${PRO_MONTHLY_USD}/mo`;

export const DEFAULT_DESCRIPTION =
  `ShopGoodwill sniper that compares auctions to eBay comps and places last-second bids. Pay ${STANDARD_FEE_LABEL} only when you win, or ${PRO_PRICE_LABEL} with ${PRO_SUCCESS_FEE_PCT}% commission.`;

export type Faq = { q: string; a: string };

export const HOME_FAQS: Faq[] = [
  {
    q: "What is a ShopGoodwill sniper?",
    a: "A ShopGoodwill sniper is software that places your max bid in the final seconds of an auction instead of bidding early. BuzzerBidder is a hosted sniper: you queue auctions from a URL or Favorites, compare them to eBay comps, and we bid with your own ShopGoodwill account near close.",
  },
  {
    q: "What is BuzzerBidder?",
    a: "BuzzerBidder is a hosted ShopGoodwill sniper. You queue auctions from a URL or your ShopGoodwill Favorites, compare them to recent eBay sales, and we place your bid in the final seconds using your own ShopGoodwill account.",
  },
  {
    q: "How does ShopGoodwill sniping work?",
    a: "You set a max bid. Our workers keep a scheduled job and fire the bid seconds before the auction ends, so you are not bidding early and pushing the price up. A bid can still be missed if ShopGoodwill or the network fails.",
  },
  {
    q: "ShopGoodwill auto bid vs manual bidding — what's the difference?",
    a: "Manual bidding means you watch the clock and click near the end. Auto bid (sniping) schedules that last-second bid for you. Hosted tools like BuzzerBidder keep the queue on a server so you do not need your laptop open. Early manual bids can also raise the visible price and attract competition.",
  },
  {
    q: "When do you charge?",
    a: `Standard has no monthly fee. We charge ${STANDARD_FEE_LABEL} of the hammer price on confirmed wins. If you do not win, there is no success fee for that auction. Small fees may batch until they meet Stripe's minimum charge. Pro is ${PRO_PRICE_LABEL} with ${PRO_SUCCESS_FEE_PCT}% commission while the subscription is active.`,
  },
  {
    q: "Does BuzzerBidder have a pay-per-win / per-snipe option?",
    a: `Yes. Standard is pay-as-you-go: ${STANDARD_FEE_LABEL} of the hammer only on confirmed wins, no monthly fee. Pro is optional at ${PRO_PRICE_LABEL} with ${PRO_SUCCESS_FEE_PCT}% success fee. That differs from tools that bill a credit every time a bid fires, including losses. You still pay ShopGoodwill for the item, shipping, and tax separately.`,
  },
  {
    q: "Do you store my ShopGoodwill password?",
    a: "Yes, encrypted at rest with AES-256-GCM. The decryption key stays on the bidding server and is used only to place bids you schedule and to check outcomes. We do not show the password in the app after you save it.",
  },
  {
    q: "Is BuzzerBidder affiliated with ShopGoodwill?",
    a: "No. BuzzerBidder is an independent tool. It is not affiliated with, endorsed by, or sponsored by ShopGoodwill or Goodwill Industries.",
  },
];

export const PRICING_FAQS: Faq[] = [
  {
    q: "What is the difference between Standard and Pro?",
    a: `Standard has no monthly fee and charges a ${STANDARD_FEE_LABEL} success fee on the hammer of confirmed wins. Pro is $${PRO_MONTHLY_USD} per month and charges ${PRO_SUCCESS_FEE_PCT}% success fee while the subscription is active. Both plans include unlimited snipes, eBay comps, and last-second bidding.`,
  },
  {
    q: "Do I pay if I lose the auction?",
    a: "No. Standard only bills a success fee when ShopGoodwill confirms you won. A lost or skipped snipe does not create a success fee.",
  },
  {
    q: "Why might fees be charged together?",
    a: `Stripe has a minimum charge amount. Small ${STANDARD_FEE_LABEL} fees can accrue and be invoiced together once they reach that minimum.`,
  },
  {
    q: "Do I need a card on file to snipe?",
    a: "Yes. Queueing a snipe requires a saved payment method on Standard or an active Pro subscription. Already-queued snipes may still fire if billing is later blocked.",
  },
  {
    q: "Can I cancel Pro?",
    a: `Yes. Cancel anytime in the Stripe billing portal from your Account page. After the subscription ends, new wins follow the Standard ${STANDARD_FEE_LABEL} success fee unless you stay on Pro.`,
  },
];
