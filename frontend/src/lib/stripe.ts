import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  _stripe = new Stripe(key, {
    apiVersion: "2025-08-27.basil",
    typescript: true,
  });
  return _stripe;
}

/** Live $10/mo Pro price (SGW Arb Pro). Legacy $15 id is ignored if still in env. */
const PRO_PRICE_MONTHLY_V2 = "price_1ULXJwANDaHjEyccO1OQj3ZO";
const PRO_PRICE_MONTHLY_V1_RETIRED = "price_1UKncFANDaHjEyccoDgwma4X";

export function getProPriceId(): string {
  const id = process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
  if (id && id !== PRO_PRICE_MONTHLY_V1_RETIRED) return id;
  return PRO_PRICE_MONTHLY_V2;
}

export function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
