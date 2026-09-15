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

export function getProPriceId(): string {
  const id = process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!id) throw new Error("STRIPE_PRICE_PRO_MONTHLY is not configured");
  return id;
}

export function appOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
