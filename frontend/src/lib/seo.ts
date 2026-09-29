export const SITE_URL = "https://buzzerbidder.com";

export const SITE_NAME = "BuzzerBidder";

export const DEFAULT_DESCRIPTION =
  "ShopGoodwill sniper that compares auctions to eBay comps and places last-second bids. Pay 2% only when you win, or $15/month with 0% commission.";

export type Faq = { q: string; a: string };

export const HOME_FAQS: Faq[] = [
  {
    q: "What is BuzzerBidder?",
    a: "BuzzerBidder is a hosted ShopGoodwill sniper. You queue auctions from a URL or your ShopGoodwill Favorites, compare them to recent eBay sales, and we place your bid in the final seconds using your own ShopGoodwill account.",
  },
  {
    q: "How does ShopGoodwill sniping work?",
    a: "You set a max bid. Our workers keep a scheduled job and fire the bid seconds before the auction ends, so you are not bidding early and pushing the price up. A bid can still be missed if ShopGoodwill or the network fails.",
  },
  {
    q: "When do you charge?",
    a: "Standard has no monthly fee. We charge 2% of the hammer price on confirmed wins. If you do not win, there is no success fee for that auction. Small fees may batch until they meet Stripe's minimum charge. Pro is $15/month with 0% commission while the subscription is active.",
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
    a: "Standard has no monthly fee and charges a 2% success fee on the hammer of confirmed wins. Pro is $15 per month and charges 0% success fee while the subscription is active. Both plans include unlimited snipes, eBay comps, and last-second bidding.",
  },
  {
    q: "Do I pay if I lose the auction?",
    a: "No. Standard only bills a success fee when ShopGoodwill confirms you won. A lost or skipped snipe does not create a success fee.",
  },
  {
    q: "Why might fees be charged together?",
    a: "Stripe has a minimum charge amount. Small 2% fees can accrue and be invoiced together once they reach that minimum.",
  },
  {
    q: "Do I need a card on file to snipe?",
    a: "Yes. Queueing a snipe requires a saved payment method on Standard or an active Pro subscription. Already-queued snipes may still fire if billing is later blocked.",
  },
  {
    q: "Can I cancel Pro?",
    a: "Yes. Cancel anytime in the Stripe billing portal from your Account page. After the subscription ends, new wins follow the Standard 2% success fee unless you stay on Pro.",
  },
];
