import { NextResponse } from "next/server";
import { appOrigin, getProPriceId, getStripe } from "@/lib/stripe";
import { createServiceClient, userFromAuthHeader } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function ensureStripeCustomer(
  userId: string,
  email: string | null
): Promise<string> {
  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: email || profile?.email || undefined,
    metadata: { supabase_user_id: userId },
  });

  await supabase.from("profiles").upsert(
    {
      id: userId,
      email: email || profile?.email || null,
      stripe_customer_id: customer.id,
      plan: "standard",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  return customer.id;
}

export async function POST(req: Request) {
  try {
    const user = await userFromAuthHeader(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const mode = body.mode as "setup" | "subscription";
    if (mode !== "setup" && mode !== "subscription") {
      return NextResponse.json({ error: "mode must be setup or subscription" }, { status: 400 });
    }

    const customerId = await ensureStripeCustomer(user.id, user.email);
    const stripe = getStripe();
    const origin = appOrigin(req);

    if (mode === "setup") {
      const session = await stripe.checkout.sessions.create({
        mode: "setup",
        customer: customerId,
        success_url: `${origin}/account?billing=success`,
        cancel_url: `${origin}/pricing?billing=cancelled`,
        metadata: { supabase_user_id: user.id, purpose: "standard_card" },
        currency: "usd",
        setup_intent_data: {
          metadata: { supabase_user_id: user.id },
        },
      });
      return NextResponse.json({ url: session.url });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: getProPriceId(), quantity: 1 }],
      success_url: `${origin}/account?billing=pro`,
      cancel_url: `${origin}/pricing?billing=cancelled`,
      metadata: { supabase_user_id: user.id, purpose: "pro_subscription" },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("stripe checkout error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Checkout failed" },
      { status: 500 }
    );
  }
}
