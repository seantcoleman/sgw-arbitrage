import { NextResponse } from "next/server";
import { appOrigin, getStripe } from "@/lib/stripe";
import { createServiceClient, userFromAuthHeader } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const user = await userFromAuthHeader(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing customer yet — start from Pricing first" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const origin = appOrigin(req);
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/account`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    console.error("stripe portal error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Portal failed" },
      { status: 500 }
    );
  }
}
